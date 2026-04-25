<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $token,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url('/?auth=reset&token=' . urlencode($this->token) . '&email=' . urlencode($notifiable->email));

        return (new MailMessage)
            ->subject('Reset your OptiDx password')
            ->greeting('Hello ' . ($notifiable->name ?? 'there') . ',')
            ->line('We received a password reset request for your OptiDx account.')
            ->action('Reset password', $url)
            ->line('If you did not request a password reset, you can safely ignore this email.');
    }
}
