<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Pathway;
use App\Models\DiagnosticTest;
use App\Models\Setting;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
            'timezone' => 'Africa/Cairo',
        ]);

        $response->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'sara@example.com')
            ->assertJsonPath('user.first_name', 'Sara')
            ->assertJsonPath('user.last_name', 'El-Sayed')
            ->assertJsonPath('user.organization', 'Syreon')
            ->assertJsonPath('user.title', 'Analyst')
            ->assertJsonPath('user.timezone', 'Africa/Cairo');

        $user = User::query()->where('email', 'sara@example.com')->firstOrFail();
        $this->assertSame('Sara El-Sayed', $user->name);
        $this->assertSame('Sara', $user->first_name);
        $this->assertSame('El-Sayed', $user->last_name);
        $this->assertSame('Syreon', $user->organization);
        $this->assertSame('Analyst', $user->title);
        $this->assertSame('Africa/Cairo', $user->timezone);
        $this->assertTrue(Hash::check('password123', $user->password));
        $this->assertNull($user->email_verified_at);

        Notification::assertSentToTimes($user, VerifyEmailNotification::class, 1);
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

    public function test_login_allows_verified_accounts_to_sign_in(): void
    {
        $user = User::create([
            'name' => 'Verified User',
            'email' => 'verified@example.com',
            'password' => Hash::make('password123'),
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $response = $this->postJson('/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Signed in successfully.')
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.first_name', 'Verified')
            ->assertJsonPath('user.last_name', 'User');

        $this->assertAuthenticatedAs($user);
    }

    public function test_profile_update_persists_account_fields(): void
    {
        Notification::fake();

        $user = User::create([
            'name' => 'Profile User',
            'first_name' => 'Profile',
            'last_name' => 'User',
            'email' => 'profile@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->putJson('/auth/profile', [
            'first_name' => 'Sara',
            'last_name' => 'Elsayed',
            'email' => 'sara.updated@example.com',
            'organization' => 'Syreon',
            'title' => 'Health economist',
            'timezone' => 'Africa/Cairo',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Profile saved.')
            ->assertJsonPath('user.first_name', 'Sara')
            ->assertJsonPath('user.last_name', 'Elsayed')
            ->assertJsonPath('user.email', 'sara.updated@example.com')
            ->assertJsonPath('user.organization', 'Syreon')
            ->assertJsonPath('user.title', 'Health economist')
            ->assertJsonPath('user.timezone', 'Africa/Cairo');

        $user->refresh();
        $this->assertSame('Sara Elsayed', $user->name);
        $this->assertSame('Sara', $user->first_name);
        $this->assertSame('Elsayed', $user->last_name);
        $this->assertSame('Syreon', $user->organization);
        $this->assertSame('Health economist', $user->title);
        $this->assertSame('Africa/Cairo', $user->timezone);
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_logout_invalidates_session(): void
    {
        $user = User::create([
            'name' => 'Logout User',
            'first_name' => 'Logout',
            'last_name' => 'User',
            'email' => 'logout@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->postJson('/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out.');

        $this->assertGuest();
        $this->getJson('/auth/me')->assertUnauthorized();
    }

    public function test_delete_account_preserves_workspace_rows_and_detaches_ownership(): void
    {
        $user = User::create([
            'name' => 'Delete User',
            'first_name' => 'Delete',
            'last_name' => 'User',
            'email' => 'delete@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user);

        $project = Project::create([
            'title' => 'Delete me project',
            'created_by' => $user->id,
            'metadata' => [],
        ]);

        $pathway = Pathway::create([
            'project_id' => $project->id,
            'name' => 'Delete me pathway',
            'editor_definition' => ['nodes' => [], 'edges' => []],
            'validation_status' => 'draft',
            'created_by' => $user->id,
        ]);

        $test = DiagnosticTest::create([
            'project_id' => $project->id,
            'name' => 'Delete me test',
            'sensitivity' => 0.9,
            'specificity' => 0.95,
            'created_by' => $user->id,
        ]);

        $setting = Setting::create([
            'created_by' => $user->id,
            'scope' => 'workspace',
            'key' => 'profile',
            'value' => ['name' => 'Delete User'],
        ]);

        $this->deleteJson('/auth/account', [
                'password' => 'password123',
            ])->assertOk()
            ->assertJsonPath('message', 'Account deleted.');

        $this->assertGuest();
        $this->assertNull(User::query()->find($user->id));
        $this->assertSame(null, DB::table('projects')->where('id', $project->id)->value('created_by'));
        $this->assertSame(null, DB::table('pathways')->where('id', $pathway->id)->value('created_by'));
        $this->assertSame(null, DB::table('diagnostic_tests')->where('id', $test->id)->value('created_by'));
        $this->assertSame(null, DB::table('settings')->where('id', $setting->id)->value('created_by'));
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
