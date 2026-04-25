<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'authenticated' => $request->user() !== null,
            'user' => $request->user(),
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

        /** @var User $user */
        $user = $request->user();
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
            'user' => $user,
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
        ]);

        $user = User::create([
            'name' => trim($data['first_name'] . ' ' . $data['last_name']),
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        event(new Registered($user));
        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Account created. Check your inbox to verify your email address.',
            'requires_verification' => true,
            'email' => $user->email,
            'user' => $user,
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
            'user' => $user,
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
}
