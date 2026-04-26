<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function normalizeUser(User $user): array
    {
        $firstName = trim((string) ($user->first_name ?: ''));
        $lastName = trim((string) ($user->last_name ?: ''));
        $name = trim((string) $user->name);

        if ($firstName === '' && $name !== '') {
            $parts = preg_split('/\s+/', $name) ?: [];
            $firstName = $parts[0] ?? $name;
            $lastName = $lastName !== '' ? $lastName : (count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '');
        }

        return [
            'id' => $user->id,
            'name' => $name,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $user->email,
            'organization' => $user->organization,
            'title' => $user->title,
            'timezone' => $user->timezone,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
            'updated_at' => $user->updated_at?->toIso8601String(),
        ];
    }

    private function syncUserProfile(User $user, array $data): array
    {
        $name = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''));
        $emailChanged = array_key_exists('email', $data) && $data['email'] !== $user->email;

        $user->forceFill([
            'name' => $name !== '' ? $name : $user->name,
            'first_name' => $data['first_name'] ?? $user->first_name,
            'last_name' => $data['last_name'] ?? $user->last_name,
            'email' => $data['email'] ?? $user->email,
            'organization' => array_key_exists('organization', $data) ? $data['organization'] : $user->organization,
            'title' => array_key_exists('title', $data) ? $data['title'] : $user->title,
            'timezone' => array_key_exists('timezone', $data) ? $data['timezone'] : $user->timezone,
        ])->save();

        if ($emailChanged) {
            $user->forceFill(['email_verified_at' => null])->save();
        }

        return [
            'user' => $user->refresh(),
            'email_changed' => $emailChanged,
        ];
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'authenticated' => $user !== null,
            'user' => $user ? $this->normalizeUser($user) : null,
        ]);
    }

    public function profile(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->normalizeUser($request->user()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'organization' => ['nullable', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:255'],
            'timezone' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $this->syncUserProfile($user, $data);
        $updated = $result['user'];

        if ($result['email_changed'] && ! $updated->hasVerifiedEmail()) {
            $updated->sendEmailVerificationNotification();
        }

        return response()->json([
            'message' => 'Profile saved.',
            'user' => $this->normalizeUser($updated),
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $remember = (bool) ($credentials['remember'] ?? false);
        unset($credentials['remember']);

        if (! Auth::attempt($credentials, $remember)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        /** @var User|null $user */
        $user = Auth::user();
        if (! $user) {
            $user = User::query()->where('email', $credentials['email'])->first();
        }

        if (! $user?->hasVerifiedEmail()) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $user = User::query()->where('email', $credentials['email'])->first();
            $user?->sendEmailVerificationNotification();

            return response()->json([
                'message' => 'Please verify your email address before signing in.',
                'requires_verification' => true,
                'email' => $credentials['email'],
            ], 409);
        }

        return response()->json([
            'message' => 'Signed in successfully.',
            'user' => $this->normalizeUser($user),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'organization' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:255'],
            'timezone' => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::create([
            'name' => trim($data['first_name'] . ' ' . $data['last_name']),
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'organization' => $data['organization'] ?? null,
            'title' => $data['role'] ?? null,
            'timezone' => $data['timezone'] ?? config('app.timezone'),
        ]);

        // The framework's Registered event already triggers the built-in
        // email-verification listener for MustVerifyEmail users, so we only
        // need to create the account and dispatch the event once here.
        event(new Registered($user));

        return response()->json([
            'message' => 'Account created. Check your inbox to verify your email address.',
            'requires_verification' => true,
            'email' => $user->email,
            'user' => $this->normalizeUser($user),
        ], 201);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['nullable', 'email'],
        ]);

        $user = $request->user();
        if (! $user && isset($payload['email'])) {
            $user = User::query()->where('email', $payload['email'])->first();
        }

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['We could not find a matching account.'],
            ]);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'This account is already verified.',
                'verified' => true,
            ]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Verification email sent.',
            'email' => $user->email,
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink($payload);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password reset link sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset($payload, function (User $user, string $password): void {
            $user->forceFill([
                'password' => Hash::make($password),
            ])->save();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        $user = User::query()->where('email', $payload['email'])->first();
        if ($user) {
            Auth::login($user);
            $request->session()->regenerate();
        }

        return response()->json([
            'message' => 'Password reset successfully.',
            'user' => $user ? $this->normalizeUser($user) : null,
        ]);
    }

    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $user = User::query()->findOrFail($id);

        if (! hash_equals($hash, sha1($user->email))) {
            abort(403);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return redirect('/?auth=verified&email=' . urlencode($user->email));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Signed out.',
        ]);
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        DB::transaction(function () use ($user, $request): void {
            DB::table('projects')->where('created_by', $user->id)->update(['created_by' => null]);
            DB::table('pathways')->where('created_by', $user->id)->update(['created_by' => null]);
            DB::table('diagnostic_tests')->where('created_by', $user->id)->update(['created_by' => null]);
            DB::table('settings')->where('created_by', $user->id)->update(['created_by' => null]);
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();

            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $user->delete();
        });

        return response()->json([
            'message' => 'Account deleted.',
        ]);
    }
}
