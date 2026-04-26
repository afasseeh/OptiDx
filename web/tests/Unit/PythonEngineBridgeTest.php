<?php

namespace Tests\Unit;

use App\Services\PythonEngineBridge;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PythonEngineBridgeTest extends TestCase
{
    public function test_ensure_writable_process_temp_directory_sets_a_project_local_temp_path(): void
    {
        $bridge = new PythonEngineBridge();

        $tempDirectory = $bridge->ensureWritableProcessTempDirectory();

        $this->assertStringContainsString('storage', $tempDirectory);
        $this->assertTrue(File::exists($tempDirectory));
        $this->assertSame($tempDirectory, getenv('TMP'));
        $this->assertSame($tempDirectory, getenv('TEMP'));
        $this->assertSame($tempDirectory, getenv('TMPDIR'));
    }

    public function test_process_can_start_after_temp_directory_is_initialized(): void
    {
        $bridge = new PythonEngineBridge();
        $tempDirectory = $bridge->ensureWritableProcessTempDirectory();

        $process = new Process([PHP_BINARY, '-r', 'echo "ok";'], base_path());
        $process->setTimeout(10);
        $process->setEnv([
            'TMP' => $tempDirectory,
            'TEMP' => $tempDirectory,
            'TMPDIR' => $tempDirectory,
        ]);
        $process->run();

        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
        $this->assertSame('ok', trim($process->getOutput()));
    }

    public function test_resolve_php_cli_binary_returns_a_cli_executable_path(): void
    {
        $bridge = new PythonEngineBridge();

        $resolved = $bridge->resolvePhpCliBinary();

        $this->assertNotSame('', $resolved);
        $this->assertStringEndsWith('.exe', strtolower($resolved));
        $this->assertStringNotContainsString('php-cgi', strtolower($resolved));
    }
}
