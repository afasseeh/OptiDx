<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_user_and_sends_verification_email(): void
    {
        Notification::fake();

        $response = $this->postJson('/auth/register', [
            'first_name' => 'Sara',
            'last_name' => 'El-Sayed',
            'email' => 'sara@example.com',
            'password' => 'password123',
            'organization' => 'Syreon',
            'role' => 'Analyst',
        ]);

        $response->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'sara@example.com');

        $user = User::query()->where('email', 'sara@example.com')->firstOrFail();
        $this->assertSame('Sara El-Sayed', $user->name);
        $this->assertTrue(Hash::check('password123', $user->password));
        $this->assertNull($user->email_verified_at);

        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_login_rejects_unverified_accounts_and_resends_verification_email(): void
    {
        Notification::fake();

        $user = User::create([
            'name' => 'Unverified User',
            'email' => 'unverified@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', $user->email);

        $this->assertGuest();
        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_verify_email_marks_the_user_as_verified(): void
    {
        $user = User::create([
            'name' => 'Verified User',
            'email' => 'verified@example.com',
            'password' => Hash::make('password123'),
        ]);

        $url = URL::temporarySignedRoute(
            'auth.verify-email',
            now()->addMinutes(60),
            [
                'id' => $user->id,
                'hash' => sha1($user->email),
            ],
        );

        $response = $this->get($url);

        $response->assertRedirect('/?auth=verified&email=' . urlencode($user->email));
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_password_reset_flow_sends_link_and_updates_password(): void
    {
        Notification::fake();

        $user = User::create([
            'name' => 'Reset User',
            'email' => 'reset@example.com',
            'password' => Hash::make('old-password'),
            'email_verified_at' => now(),
        ]);

        $forgotResponse = $this->postJson('/auth/forgot-password', [
            'email' => $user->email,
        ]);

        $forgotResponse->assertOk()
            ->assertJsonPath('message', 'Password reset link sent.');

        Notification::assertSentTo($user, ResetPasswordNotification::class);

        $token = Password::broker()->createToken($user);

        $resetResponse = $this->postJson('/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-password123',
            'password_confirmation' => 'new-password123',
        ]);

        $resetResponse->assertOk()
            ->assertJsonPath('message', 'Password reset successfully.');

        $this->assertTrue(Hash::check('new-password123', $user->fresh()->password));
        $this->assertAuthenticatedAs($user);
    }

    public function test_me_endpoint_reports_authenticated_user(): void
    {
        $user = User::create([
            'name' => 'Session User',
            'email' => 'session@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->getJson('/auth/me')
            ->assertOk()
            ->assertJsonPath('authenticated', true)
            ->assertJsonPath('user.email', $user->email);
    }
}
