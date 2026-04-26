<?php

namespace App\Notifications;

use App\Models\OptimizationRun;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OptimizationRunCompletedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly OptimizationRun $run)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $status = ucfirst(str_replace('_', ' ', (string) $this->run->status));
        $mode = ucfirst((string) ($this->run->run_mode ?? 'light'));
        $feasible = (int) ($this->run->feasible_count ?? 0);
        $candidates = (int) ($this->run->candidate_count ?? 0);

        $message = (new MailMessage)
            ->subject("OptiDx optimization {$status} ({$mode})")
            ->greeting('Your OptiDx optimization run has finished.')
            ->line("Run ID: {$this->run->id}")
            ->line("Mode: {$mode}")
            ->line("Status: {$status}")
            ->line("Feasible candidates: {$feasible}")
            ->line("Evaluated candidates: {$candidates}");

        if ($this->run->progress_message) {
            $message->line("Last progress update: {$this->run->progress_message}");
        }

        $message->action('Open optimization run', url('/?screen=scenarios&run=' . $this->run->id));

        if ($this->run->failure_reason) {
            $message->line($this->run->failure_reason);
        }

        return $message->salutation('OptiDx');
    }
}
