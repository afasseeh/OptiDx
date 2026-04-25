<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class PythonEngineBridge
{
    public function run(string $action, array $payload): array
    {
        $root = dirname(base_path());
        $process = new Process(['python', '-m', 'optidx_package.optidx.cli', $action], $root);
        $process->setInput(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $process->setEnv([
            'PYTHONPATH' => $root,
        ]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException(trim($process->getErrorOutput()) ?: 'Python engine bridge failed.');
        }

        $decoded = json_decode($process->getOutput(), true);
        if (! is_array($decoded)) {
            throw new RuntimeException('Python engine returned invalid JSON.');
        }

        return $decoded;
    }

    public function validate(array $payload): array
    {
        return $this->run('validate', $payload);
    }

    public function evaluate(array $payload): array
    {
        return $this->run('evaluate', $payload);
    }

    public function benchmark(array $payload): array
    {
        return $this->run('benchmark', $payload);
    }
}
