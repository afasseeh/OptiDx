@php
    $summary = $report['summary'] ?? [];
    $project = $report['project'] ?? [];
    $pathway = $report['pathway'] ?? [];
    $tests = $report['tests'] ?? [];
    $paths = $report['paths'] ?? [];
    $warnings = $report['warnings'] ?? [];
    $settings = $report['settings'] ?? [];
    $sections = $report['sections'] ?? [];
    $generatedSections = $report['generated_sections'] ?? [];

    $formatPercent = static function ($value): string {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return number_format((float) $value * 100, 1) . '%';
    };

    $formatMoney = static function ($value): string {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return '$' . number_format((float) $value, 2);
    };

    $formatNumber = static function ($value, int $precision = 2): string {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return number_format((float) $value, $precision);
    };

    $testsText = collect($tests)
        ->pluck('name')
        ->filter()
        ->implode(' · ');

    $pathText = collect($paths)
        ->pluck('sequence')
        ->filter()
        ->implode(' / ');

    $sectionDraft = static function (array $section) use ($generatedSections): array {
        $id = $section['id'] ?? null;
        $draft = is_string($id) && is_array($generatedSections[$id] ?? null) ? $generatedSections[$id] : [];

        return [
            'title' => $draft['title'] ?? ($section['label'] ?? ($id ?: 'Section')),
            'content' => $draft['content'] ?? ($section['description'] ?? 'No additional narrative was stored for this section.'),
            'bullets' => is_array($draft['bullets'] ?? null) ? $draft['bullets'] : [],
            'tables' => is_array($draft['tables'] ?? null) ? $draft['tables'] : [],
        ];
    };
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $report['title'] ?? 'OptiDx report' }}</title>
    <style>
        :root {
            --ink: #1c1e21;
            --muted: #6d757f;
            --line: #d9dde2;
            --soft: #f6f7f8;
            --accent: #f37739;
            --accent-soft: #fff2ea;
        }

        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: #eef1f4;
            color: var(--ink);
            font-family: Arial, Helvetica, sans-serif;
        }
        .sheet {
            max-width: 900px;
            margin: 24px auto;
            background: #fff;
            box-shadow: 0 12px 32px rgba(16, 24, 40, 0.08);
            border: 1px solid rgba(0, 0, 0, 0.04);
        }
        .page {
            padding: 44px 52px 54px;
            page-break-after: always;
            min-height: 1120px;
            position: relative;
        }
        .page:last-child {
            page-break-after: auto;
        }
        .brand {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid var(--accent);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .brand__mark {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .brand__badge {
            width: 34px;
            height: 34px;
            border-radius: 6px;
            background: var(--accent);
            color: #fff;
            display: grid;
            place-items: center;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 0.04em;
        }
        .eyebrow {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--muted);
            margin-bottom: 6px;
        }
        h1, h2, h3, p {
            margin: 0;
        }
        h1 {
            font-size: 26px;
            line-height: 1.2;
            margin-bottom: 8px;
        }
        h2 {
            font-size: 15px;
            margin-bottom: 10px;
            color: var(--ink);
        }
        .meta {
            color: var(--muted);
            font-size: 12px;
            line-height: 1.55;
        }
        .grid {
            display: grid;
            gap: 12px;
        }
        .grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .metric {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 14px 16px;
            background: #fff;
        }
        .metric--accent {
            border-color: var(--accent-soft);
            background: var(--accent-soft);
        }
        .metric__label {
            font-size: 10px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 4px;
        }
        .metric__value {
            font-size: 20px;
            font-weight: 700;
            color: var(--ink);
        }
        .section {
            margin-bottom: 24px;
        }
        .box {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 14px 16px;
            background: #fff;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .table th,
        .table td {
            border-bottom: 1px solid var(--line);
            padding: 10px 8px;
            text-align: left;
            vertical-align: top;
        }
        .table th {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--muted);
        }
        .table td.num,
        .table th.num {
            text-align: right;
            white-space: nowrap;
        }
        .pill {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            border: 1px solid var(--line);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--muted);
        }
        .callout {
            border-left: 3px solid var(--accent);
            background: #fff8f2;
            padding: 12px 14px;
            border-radius: 8px;
            margin-top: 10px;
        }
        .warning {
            border: 1px solid #f1d2b7;
            background: #fffaf5;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 10px;
            font-size: 12px;
            line-height: 1.5;
        }
        .footer {
            position: absolute;
            left: 52px;
            right: 52px;
            bottom: 18px;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            border-top: 1px solid var(--line);
            padding-top: 10px;
            font-size: 9px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--muted);
        }
    </style>
</head>
<body>
    <div class="sheet">
        <section class="page">
            <div class="brand">
                <div>
                    <div class="brand__mark">
                        <div class="brand__badge">SME</div>
                        <div>
                            <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:var(--accent);">Syreon</div>
                            <div class="meta" style="text-transform:uppercase;letter-spacing:0.12em;">OptiDx decision report</div>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <div class="eyebrow">Executive summary</div>
                        <h1>{{ $report['title'] ?? 'OptiDx report' }}</h1>
                        <p class="meta">{{ $report['subtitle'] ?? ($project['title'] ?? 'Workspace pathway') }}</p>
                    </div>
                </div>
                <div style="text-align:right;font-size:11px;line-height:1.5;color:var(--muted);">
                    <div style="font-weight:700;color:var(--ink);letter-spacing:0.14em;">CONFIDENTIAL</div>
                    <div>{{ $report['generated_at'] ?? now()->toIso8601String() }}</div>
                    <div style="margin-top:10px;" class="pill">{{ $project['title'] ?? 'Standalone pathway' }}</div>
                </div>
            </div>

            <div class="section">
                <div class="grid grid--3">
                    <div class="metric metric--accent">
                        <div class="metric__label">Sensitivity</div>
                        <div class="metric__value">{{ $formatPercent($summary['sensitivity'] ?? null) }}</div>
                    </div>
                    <div class="metric metric--accent">
                        <div class="metric__label">Specificity</div>
                        <div class="metric__value">{{ $formatPercent($summary['specificity'] ?? null) }}</div>
                    </div>
                    <div class="metric metric--accent">
                        <div class="metric__label">Expected cost</div>
                        <div class="metric__value">{{ $formatMoney($summary['expected_cost'] ?? null) }}</div>
                    </div>
                </div>
            </div>

            <div class="section grid grid--2">
                <div class="box">
                    <h2>Project context</h2>
                    <div class="meta">
                        <div><strong>Disease area:</strong> {{ $project['disease_area'] ?? 'n/a' }}</div>
                        <div><strong>Intended use:</strong> {{ $project['intended_use'] ?? 'n/a' }}</div>
                        <div><strong>Target population:</strong> {{ $project['target_population'] ?? 'n/a' }}</div>
                        <div><strong>Prevalence:</strong> {{ $formatPercent($summary['prevalence'] ?? null) }}</div>
                    </div>
                </div>
                <div class="box">
                    <h2>Pathway overview</h2>
                    <div class="meta">
                        <div><strong>Pathway:</strong> {{ $pathway['name'] ?? 'Untitled pathway' }}</div>
                        <div><strong>Start node:</strong> {{ $pathway['start_node_id'] ?? 'n/a' }}</div>
                        <div><strong>Workflow:</strong> {{ $pathText ?: 'No path trace available' }}</div>
                        <div><strong>Included tests:</strong> {{ $testsText ?: 'No attached tests' }}</div>
                    </div>
                </div>
            </div>

            <div class="section box">
                <h2>Aggregate diagnostic accuracy</h2>
                <table class="table">
                    <tbody>
                        <tr>
                            <td>Sensitivity</td>
                            <td class="num">{{ $formatPercent($summary['sensitivity'] ?? null) }}</td>
                            <td>Specificity</td>
                            <td class="num">{{ $formatPercent($summary['specificity'] ?? null) }}</td>
                        </tr>
                        <tr>
                            <td>PPV</td>
                            <td class="num">{{ $formatPercent($summary['ppv'] ?? null) }}</td>
                            <td>NPV</td>
                            <td class="num">{{ $formatPercent($summary['npv'] ?? null) }}</td>
                        </tr>
                        <tr>
                            <td>Expected cost</td>
                            <td class="num">{{ $formatMoney($summary['expected_cost'] ?? null) }}</td>
                            <td>Turnaround</td>
                            <td class="num">{{ $summary['turnaround'] ?? 'n/a' }}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="callout">
                    {{ $summary['warnings'] ? $summary['warnings'] . ' warning(s) were carried into this report.' : 'No report warnings were recorded for the current evaluation.' }}
                </div>
            </div>

            <div class="footer">
                <span>Today&apos;s research for tomorrow&apos;s health</span>
                <span>Page 1</span>
            </div>
        </section>

        <section class="page">
            <div class="brand" style="margin-bottom:18px;">
                <div>
                    <div class="eyebrow">Path-level outcomes</div>
                    <h1 style="font-size:22px;">Path trace and test contribution</h1>
                    <p class="meta">This section captures the resolved pathway trace and the tests that contributed to the export snapshot.</p>
                </div>
                <div class="pill">{{ count($paths) }} paths</div>
            </div>

            <div class="section box">
                <h2>Path-level outcome table</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Path</th>
                            <th>Sequence</th>
                            <th>Terminal</th>
                            <th class="num">P(path | D+)</th>
                            <th class="num">P(path | D-)</th>
                            <th class="num">Cost</th>
                            <th class="num">TAT</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($paths as $path)
                            <tr>
                                <td>{{ $path['id'] ?? 'n/a' }}</td>
                                <td>{{ $path['sequence'] ?? 'n/a' }}</td>
                                <td>{{ $path['terminal'] ?? 'n/a' }}</td>
                                <td class="num">{{ $formatPercent($path['pIfD'] ?? null) }}</td>
                                <td class="num">{{ $formatPercent($path['pIfND'] ?? null) }}</td>
                                <td class="num">{{ $formatMoney($path['cost'] ?? null) }}</td>
                                <td class="num">{{ $path['tat'] ?? 'n/a' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="meta">No path trace was available for this report snapshot.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="section grid grid--2">
                <div class="box">
                    <h2>Included tests</h2>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Test</th>
                                <th class="num">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($tests as $test)
                                <tr>
                                    <td>
                                        <div style="font-weight:700;">{{ $test['name'] ?? $test['id'] ?? 'Test' }}</div>
                                        <div class="meta">{{ $test['sample'] ?? 'n/a' }} · {{ $test['skill'] ?? 'n/a' }}</div>
                                    </td>
                                    <td class="num">{{ $formatMoney($test['cost'] ?? null) }}</td>
                                </tr>
                            @empty
                                <tr><td colspan="2" class="meta">No tests were attached to this report snapshot.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
                <div class="box">
                    <h2>Warnings</h2>
                    @forelse ($warnings as $warning)
                        <div class="warning">
                            {{ is_array($warning) ? ($warning['text'] ?? 'Warning') : $warning }}
                        </div>
                    @empty
                        <div class="meta">No warnings were recorded for this export snapshot.</div>
                    @endforelse
                </div>
            </div>

            <div class="footer">
                <span>Syreon MENA HTA</span>
                <span>Page 2</span>
            </div>
        </section>

        <section class="page">
            <div class="brand" style="margin-bottom:18px;">
                <div>
                    <div class="eyebrow">Template settings</div>
                    <h1 style="font-size:22px;">Report settings and sections</h1>
                    <p class="meta">This page captures the report template settings that generated the export snapshot.</p>
                </div>
                <div class="pill">{{ $settings['template'] ?? 'OptiDx decision report' }}</div>
            </div>

            <div class="section grid grid--2">
                <div class="box">
                    <h2>Brand and output</h2>
                    <div class="meta" style="line-height:1.65;">
                        <div><strong>Organization:</strong> {{ $settings['brand']['organization'] ?? 'Syreon' }}</div>
                        <div><strong>Issuer:</strong> {{ $settings['brand']['issuer'] ?? 'Syreon MENA HTA' }}</div>
                        <div><strong>Accent:</strong> {{ $settings['brand']['accent'] ?? '#F37739' }}</div>
                        <div><strong>Footer:</strong> {{ $settings['brand']['footer'] ?? "Today's research for tomorrow's health" }}</div>
                        <div><strong>Formats:</strong> {{ implode(' · ', $settings['output']['formats'] ?? ['pdf', 'docx']) }}</div>
                        <div><strong>Render mode:</strong> {{ $settings['output']['render_mode'] ?? 'HTML-first -> PDF conversion' }}</div>
                        <div><strong>Access:</strong> {{ $settings['output']['access'] ?? 'Authenticated workspace users' }}</div>
                    </div>
                </div>

                <div class="box">
                    <h2>Audience and include toggles</h2>
                    <div class="meta" style="line-height:1.65;">
                        <div><strong>Primary audience:</strong> {{ $settings['audience']['primary'] ?? 'Decision makers' }}</div>
                        <div><strong>Secondary audience:</strong> {{ $settings['audience']['secondary'] ?? 'HTA reviewers and implementation teams' }}</div>
                    </div>
                    <table class="table" style="margin-top:12px;">
                        <thead>
                            <tr>
                                <th>Include setting</th>
                                <th class="num">Enabled</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach (($settings['include'] ?? []) as $label => $enabled)
                                <tr>
                                    <td>{{ str_replace('_', ' ', ucfirst($label)) }}</td>
                                    <td class="num">{{ $enabled ? 'Yes' : 'No' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section box">
                <h2>Section map</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Section</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($sections as $section)
                            <tr>
                                <td>{{ $section['label'] ?? $section['id'] ?? 'Section' }}</td>
                                <td class="meta">{{ $section['description'] ?? 'No description available.' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="2" class="meta">No section metadata was stored for this report snapshot.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <span>{{ $settings['brand']['footer'] ?? "Today's research for tomorrow's health" }}</span>
                <span>Page 3</span>
            </div>
        </section>

        <section class="page">
            <div class="brand" style="margin-bottom:18px;">
                <div>
                    <div class="eyebrow">Narrative sections</div>
                    <h1 style="font-size:22px;">Generated report sections</h1>
                    <p class="meta">Each enabled section below prefers persisted AI-authored narrative and falls back to deterministic snapshot copy when AI text is not available.</p>
                </div>
                <div class="pill">Page 4</div>
            </div>

            @forelse (collect($sections)->filter(fn ($section) => ($section['enabled'] ?? true) !== false)->values() as $section)
                @php($draft = $sectionDraft($section))
                <div class="section box">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;">
                        <h2 style="margin-bottom:0;">{{ $draft['title'] }}</h2>
                        <span class="pill">{{ isset($section['page']) ? 'p.' . $section['page'] : 'Enabled' }}</span>
                    </div>
                    <div class="meta" style="font-size:13px;color:var(--ink);line-height:1.75;white-space:pre-wrap;">{{ $draft['content'] }}</div>

                    @if ($draft['bullets'] !== [])
                        <ul style="margin:12px 0 0 18px;padding:0;font-size:12px;line-height:1.7;color:var(--ink);">
                            @foreach ($draft['bullets'] as $bullet)
                                <li>{{ $bullet }}</li>
                            @endforeach
                        </ul>
                    @endif

                    @if ($draft['tables'] !== [])
                        @foreach ($draft['tables'] as $table)
                            <div style="margin-top:14px;">
                                @if (!empty($table['title']))
                                    <div style="font-weight:700;margin-bottom:8px;">{{ $table['title'] }}</div>
                                @endif
                                <table class="table">
                                    @if (!empty($table['columns']))
                                        <thead>
                                            <tr>
                                                @foreach ($table['columns'] as $column)
                                                    <th>{{ $column }}</th>
                                                @endforeach
                                            </tr>
                                        </thead>
                                    @endif
                                    <tbody>
                                        @foreach (($table['rows'] ?? []) as $row)
                                            <tr>
                                                @foreach ($row as $value)
                                                    <td>{{ $value }}</td>
                                                @endforeach
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @endforeach
                    @endif
                </div>
            @empty
                <div class="section box">
                    <div class="meta">No enabled section metadata was available for this report snapshot.</div>
                </div>
            @endforelse

            <div class="footer">
                <span>{{ $settings['brand']['footer'] ?? "Today's research for tomorrow's health" }}</span>
                <span>Page 4</span>
            </div>
        </section>
    </div>
</body>
</html>
