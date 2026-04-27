<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class PythonEngineBridge
{
    public function run(string $action, array $payload): array
    {
        $this->ensureWritableProcessTempDirectory();
        $root = dirname(base_path());
        $process = new Process($this->pythonCommand($action), $root);
        $process->setInput(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $process->setEnv([
            'PYTHONPATH' => $root,
        ]);
        $process->setTimeout(null);
        $process->setIdleTimeout(null);
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

    public function optimize(array $payload, ?callable $progressCallback = null): array
    {
        $this->ensureWritableProcessTempDirectory();
        if (! $progressCallback) {
            return $this->run('optimize', $payload);
        }

        $root = dirname(base_path());
        $process = new Process($this->pythonCommand('optimize'), $root);
        $process->setInput(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $process->setEnv([
            'PYTHONPATH' => $root,
        ]);
        $process->setTimeout(null);
        $process->setIdleTimeout(null);

        $stdoutBuffer = '';
        $stderrBuffer = '';
        $finalResult = null;

        $process->run(function (string $type, string $buffer) use (&$stdoutBuffer, &$stderrBuffer, &$finalResult, $progressCallback): void {
            if ($type === Process::ERR) {
                $stderrBuffer .= $buffer;
                return;
            }

            $stdoutBuffer .= $buffer;
            while (($newlinePosition = strpos($stdoutBuffer, "\n")) !== false) {
                $line = trim(substr($stdoutBuffer, 0, $newlinePosition));
                $stdoutBuffer = substr($stdoutBuffer, $newlinePosition + 1);
                if ($line === '') {
                    continue;
                }

                $decoded = json_decode($line, true);
                if (! is_array($decoded)) {
                    continue;
                }

                if (($decoded['type'] ?? null) === 'progress' && is_callable($progressCallback)) {
                    $progressCallback($decoded);
                    continue;
                }

                if (($decoded['type'] ?? null) === 'result') {
                    $finalResult = $decoded['payload'] ?? null;
                }
            }
        });

        if (! $process->isSuccessful()) {
            throw new RuntimeException(trim($stderrBuffer) ?: 'Python engine bridge failed.');
        }

        if ($stdoutBuffer !== '') {
            $decoded = json_decode(trim($stdoutBuffer), true);
            if (is_array($decoded)) {
                if (($decoded['type'] ?? null) === 'progress' && is_callable($progressCallback)) {
                    $progressCallback($decoded);
                } elseif (($decoded['type'] ?? null) === 'result') {
                    $finalResult = $decoded['payload'] ?? null;
                }
            }
        }

        if (! is_array($finalResult)) {
            $decoded = json_decode($process->getOutput(), true);
            if (is_array($decoded) && isset($decoded['type']) && $decoded['type'] === 'result' && is_array($decoded['payload'] ?? null)) {
                $finalResult = $decoded['payload'];
            }
        }

        if (! is_array($finalResult)) {
            throw new RuntimeException('Python engine returned invalid optimization output.');
        }

        return $finalResult;
    }

    /**
     * Resolve the Python command in a way that works in both Laragon and
     * Windows test shells where `python` is not always on PATH.
     */
    private function pythonCommand(string $action): array
    {
        $explicit = getenv('PYTHON_EXECUTABLE') ?: getenv('PYTHON_BIN');
        if (is_string($explicit) && $explicit !== '' && is_file($explicit)) {
            return [$explicit, '-m', 'optidx_package.optidx.cli', $action];
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $laragonPython = 'C:\\laragon\\bin\\python\\python-3.13\\python.exe';
            if (is_file($laragonPython)) {
                return [$laragonPython, '-m', 'optidx_package.optidx.cli', $action];
            }
        }

        $finder = new ExecutableFinder();
        foreach (['python', 'python3'] as $candidate) {
            $found = $finder->find($candidate);
            if (is_string($found) && $found !== '') {
                return [$found, '-m', 'optidx_package.optidx.cli', $action];
            }
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $py = $finder->find('py');
            if (is_string($py) && $py !== '') {
                return [$py, '-3', '-m', 'optidx_package.optidx.cli', $action];
            }
        }

        return ['python', '-m', 'optidx_package.optidx.cli', $action];
    }

    /**
     * Symfony Process on Windows falls back to the system temp directory when
     * no writable temp location is available. In this environment that can be
     * `C:\Windows`, which is not writable for the app user and breaks detached
     * launches before the child process even starts.
     *
     * We force all PHP process helpers onto a project-local temp directory so
     * both foreground and detached optimization runs can create their lock and
     * pipe files without depending on machine-wide temp configuration.
     */
    public function ensureWritableProcessTempDirectory(): string
    {
        $directory = storage_path('app/process-temp');
        File::ensureDirectoryExists($directory);

        $resolved = realpath($directory) ?: $directory;
        foreach (['TMP', 'TEMP', 'TMPDIR'] as $key) {
            putenv($key . '=' . $resolved);
            $_ENV[$key] = $resolved;
            $_SERVER[$key] = $resolved;
        }

        return $resolved;
    }

    /**
     * Resolve a CLI-capable PHP binary for detached Artisan launches.
     *
     * Web requests on Windows frequently run under `php-cgi.exe`, which cannot
     * be treated as the durable CLI runtime for background Artisan commands.
     * We prefer an explicit override first, then a sibling `php.exe` next to the
     * current runtime, and finally normal PATH lookups.
     */
    public function resolvePhpCliBinary(): string
    {
        $explicit = getenv('PHP_CLI_BINARY') ?: getenv('PHP_BINARY_CLI');
        if (is_string($explicit) && $explicit !== '' && is_file($explicit)) {
            return $explicit;
        }

        $currentBinary = PHP_BINARY;
        if (is_string($currentBinary) && $currentBinary !== '') {
            $basename = strtolower(basename($currentBinary));
            if (in_array($basename, ['php', 'php.exe'], true)) {
                return $currentBinary;
            }

            $siblingCli = dirname($currentBinary) . DIRECTORY_SEPARATOR . (PHP_OS_FAMILY === 'Windows' ? 'php.exe' : 'php');
            if (is_file($siblingCli)) {
                return $siblingCli;
            }
        }

        $phpBindirCli = PHP_BINDIR . DIRECTORY_SEPARATOR . (PHP_OS_FAMILY === 'Windows' ? 'php.exe' : 'php');
        if (is_file($phpBindirCli)) {
            return $phpBindirCli;
        }

        $finder = new ExecutableFinder();
        $found = $finder->find('php');
        if (is_string($found) && $found !== '') {
            return $found;
        }

        return $currentBinary;
    }
}
