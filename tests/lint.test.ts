import { describe, test, expect } from 'bun:test';
import {
  lintBrandNames, lintBareUrls,
  lintUnclosedCodeFence, lintCodeBlockLanguage,
  lintEmDash, lintPlaceholderText,
  lintEmptyImageAlt, lintLongCodeBlock,
  type LintMessage,
} from '../src/lint.ts';

// ─── lintBrandNames ──────────────────────────────────────────────────────────

describe('lintBrandNames', () => {
  test('detects "Redhat" misspelling', () => {
    const issues = lintBrandNames('We use Redhat Enterprise Linux.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Red Hat');
    expect(issues[0].level).toBe('warn');
    expect(issues[0].line).toBe(1);
  });

  test('accepts correct "Red Hat" spelling', () => {
    const issues = lintBrandNames('We use Red Hat Enterprise Linux.');
    expect(issues).toHaveLength(0);
  });

  test('detects "openshift" case mismatch', () => {
    const issues = lintBrandNames('Deploy on openshift today');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('OpenShift');
  });

  test('accepts correct "OpenShift" spelling', () => {
    const issues = lintBrandNames('Deploy on OpenShift.');
    expect(issues).toHaveLength(0);
  });

  test('detects "kubernetes" case mismatch', () => {
    const issues = lintBrandNames('Running on kubernetes cluster.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Kubernetes');
  });

  test('detects "ansible" case mismatch', () => {
    const issues = lintBrandNames('Use ansible for automation.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Ansible');
  });

  test('skips brand names inside code blocks', () => {
    const text = '```\ninstall redhat packages\n```';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('skips brand names inside URLs', () => {
    const text = 'Visit https://console.redhat.com for details.';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('reports correct line numbers', () => {
    const text = 'Line 1\nRedhat here\nLine 3\nRedhat again';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(2);
    expect(issues[0].line).toBe(2);
    expect(issues[1].line).toBe(4);
  });

  test('handles empty input', () => {
    expect(lintBrandNames('')).toEqual([]);
  });

  test('handles multiple issues on same line', () => {
    const issues = lintBrandNames('Use openshift and kubernetes together.');
    expect(issues).toHaveLength(2);
  });

  test('skips brand names inside tilde code fence', () => {
    const text = '~~~\nRedhat\n~~~\nReal text';
    const issues = lintBrandNames(text);
    expect(issues).toHaveLength(0);
  });

  test('does not flag brand name inside inline code', () => {
    const issues = lintBrandNames('Use `openshift` as a value.');
    expect(issues).toHaveLength(0);
  });

  test('detects "Rhel" misspelling → RHEL', () => {
    const issues = lintBrandNames('Install Rhel on bare metal.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('RHEL');
  });

  test('accepts correct "RHEL" spelling', () => {
    const issues = lintBrandNames('Install RHEL on bare metal.');
    expect(issues).toHaveLength(0);
  });

  test('detects "fedora" case mismatch → Fedora', () => {
    const issues = lintBrandNames('Run fedora workstation.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Fedora');
  });

  test('accepts correct "Fedora" spelling', () => {
    const issues = lintBrandNames('Run Fedora workstation.');
    expect(issues).toHaveLength(0);
  });

  test('detects "podman" case mismatch → Podman', () => {
    const issues = lintBrandNames('Use podman for containers.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('Podman');
  });

  test('accepts correct "Podman" spelling', () => {
    const issues = lintBrandNames('Use Podman for containers.');
    expect(issues).toHaveLength(0);
  });

  test('detects "Centos" misspelling → CentOS', () => {
    const issues = lintBrandNames('Upgrade from Centos to RHEL.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('CentOS');
  });

  test('detects "centos" misspelling → CentOS', () => {
    const issues = lintBrandNames('Upgrade from centos to RHEL.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('CentOS');
  });

  test('accepts correct "CentOS" spelling', () => {
    const issues = lintBrandNames('Upgrade from CentOS to RHEL.');
    expect(issues).toHaveLength(0);
  });

  test('does not flag /fedora in path context', () => {
    const issues = lintBrandNames('See /fedora/release for info.');
    expect(issues).toHaveLength(0);
  });

  test('does not flag .podman in file-extension context', () => {
    const issues = lintBrandNames('Edit the .podman config file.');
    expect(issues).toHaveLength(0);
  });

  test('does not flag fedora after colon', () => {
    const issues = lintBrandNames('registry:fedora is a valid tag.');
    expect(issues).toHaveLength(0);
  });
});

// ─── lintBareUrls ────────────────────────────────────────────────────────────

describe('lintBareUrls', () => {
  test('detects bare URL in prose', () => {
    const issues = lintBareUrls('Check out https://docs.redhat.com/en/documentation for more info.');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('Bare URL');
  });

  test('skips URLs wrapped in markdown links', () => {
    const issues = lintBareUrls('See [docs](https://docs.redhat.com/en/documentation) for more.');
    expect(issues).toHaveLength(0);
  });

  test('skips lines that are just a URL', () => {
    const issues = lintBareUrls('https://example.com/some/long/path/here');
    expect(issues).toHaveLength(0);
  });

  test('skips URLs inside code blocks', () => {
    const text = '```\nhttps://example.com/api/endpoint in code\n```';
    const issues = lintBareUrls(text);
    expect(issues).toHaveLength(0);
  });

  test('skips very short URLs (likely false positives)', () => {
    const issues = lintBareUrls('Go to http://x.co for info.');
    expect(issues).toHaveLength(0);
  });

  test('reports correct line number', () => {
    const text = 'Line 1\nCheck https://docs.example.com/path/to/resource here\nLine 3';
    const issues = lintBareUrls(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(2);
  });

  test('handles empty input', () => {
    expect(lintBareUrls('')).toEqual([]);
  });

  test('flags bare URL alongside markdown link', () => {
    const issues = lintBareUrls('See [docs](https://a.com) and https://docs.example.com/path');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
  });

  test('does not flag line with only markdown link', () => {
    const issues = lintBareUrls('See [docs](https://a.com)');
    expect(issues).toHaveLength(0);
  });
});

// ─── lintUnclosedCodeFence ──────────────────────────────────────────────────

describe('lintUnclosedCodeFence', () => {
  test('unclosed backtick fence reports error', () => {
    const text = '```js\nconst x = 1;\n';
    const issues = lintUnclosedCodeFence(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].line).toBe(1);
    expect(issues[0].msg).toContain('Unclosed');
  });

  test('closed backtick fence is OK', () => {
    const text = '```js\nconst x = 1;\n```';
    const issues = lintUnclosedCodeFence(text);
    expect(issues).toHaveLength(0);
  });

  test('unclosed tilde fence reports error', () => {
    const text = '~~~python\nprint("hello")\n';
    const issues = lintUnclosedCodeFence(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].line).toBe(1);
  });

  test('closed tilde fence is OK', () => {
    const text = '~~~python\nprint("hello")\n~~~';
    const issues = lintUnclosedCodeFence(text);
    expect(issues).toHaveLength(0);
  });

  test('mismatched fence types leaves fence open', () => {
    const text = '```js\ncode\n~~~';
    const issues = lintUnclosedCodeFence(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
  });

  test('handles empty input', () => {
    expect(lintUnclosedCodeFence('')).toEqual([]);
  });
});

// ─── lintCodeBlockLanguage ──────────────────────────────────────────────────

describe('lintCodeBlockLanguage', () => {
  test('missing language tag warns', () => {
    const text = '```\ncode here\n```';
    const issues = lintCodeBlockLanguage(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('language tag');
  });

  test('has language tag is OK', () => {
    const text = '```javascript\nconst x = 1;\n```';
    const issues = lintCodeBlockLanguage(text);
    expect(issues).toHaveLength(0);
  });

  test('fence inside code block is skipped', () => {
    // A ``` inside an already open ``` block just closes it
    const text = '```yaml\nkey: value\n```\n```\nno lang\n```';
    const issues = lintCodeBlockLanguage(text);
    expect(issues).toHaveLength(1); // only the second block
    expect(issues[0].line).toBe(4);
  });

  test('tilde fence without lang tag warns', () => {
    const text = '~~~\ncode\n~~~';
    const issues = lintCodeBlockLanguage(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('language tag');
  });

  test('handles empty input', () => {
    expect(lintCodeBlockLanguage('')).toEqual([]);
  });
});

// ─── lintEmDash ─────────────────────────────────────────────────────────────

describe('lintEmDash', () => {
  test('em dash in prose warns', () => {
    const text = 'This is a sentence \u2014 with an em dash.';
    const issues = lintEmDash(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('Em dash');
  });

  test('em dash inside code block is skipped', () => {
    const text = '```\nvalue \u2014 other\n```';
    const issues = lintEmDash(text);
    expect(issues).toHaveLength(0);
  });

  test('em dash in heading is skipped', () => {
    const text = '## Title \u2014 Subtitle';
    const issues = lintEmDash(text);
    expect(issues).toHaveLength(0);
  });

  test('no em dash is OK', () => {
    const text = 'This is normal text with a hyphen - here.';
    const issues = lintEmDash(text);
    expect(issues).toHaveLength(0);
  });

  test('handles empty input', () => {
    expect(lintEmDash('')).toEqual([]);
  });
});

// ─── lintPlaceholderText ────────────────────────────────────────────────────

describe('lintPlaceholderText', () => {
  test('TODO in prose warns', () => {
    const text = 'This section is TODO.';
    const issues = lintPlaceholderText(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('TODO');
  });

  test('placeholder inside code block is skipped', () => {
    const text = '```\n# TODO: fix this\n```';
    const issues = lintPlaceholderText(text);
    expect(issues).toHaveLength(0);
  });

  test('case insensitive detection', () => {
    const issues1 = lintPlaceholderText('todo: finish this');
    expect(issues1).toHaveLength(1);
    const issues2 = lintPlaceholderText('This is tbd');
    expect(issues2).toHaveLength(1);
  });

  test('detects FIXME', () => {
    const issues = lintPlaceholderText('FIXME: broken link');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('FIXME');
  });

  test('detects XXX', () => {
    const issues = lintPlaceholderText('XXX needs review');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('XXX');
  });

  test('detects PLACEHOLDER', () => {
    const issues = lintPlaceholderText('This is placeholder text');
    expect(issues).toHaveLength(1);
  });

  test('handles empty input', () => {
    expect(lintPlaceholderText('')).toEqual([]);
  });
});

// ─── lintEmptyImageAlt ──────────────────────────────────────────────────────

describe('lintEmptyImageAlt', () => {
  test('empty alt text warns', () => {
    const text = '![](image.png)';
    const issues = lintEmptyImageAlt(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain('alt text');
  });

  test('non-empty alt text is OK', () => {
    const text = '![description](image.png)';
    const issues = lintEmptyImageAlt(text);
    expect(issues).toHaveLength(0);
  });

  test('empty alt inside code block is skipped', () => {
    const text = '```\n![](image.png)\n```';
    const issues = lintEmptyImageAlt(text);
    expect(issues).toHaveLength(0);
  });

  test('reports correct line number', () => {
    const text = 'Line 1\n![](pic.png)\nLine 3';
    const issues = lintEmptyImageAlt(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(2);
  });

  test('handles empty input', () => {
    expect(lintEmptyImageAlt('')).toEqual([]);
  });
});

// ─── lintLongCodeBlock ──────────────────────────────────────────────────────

describe('lintLongCodeBlock', () => {
  test('51-line block warns with default maxLines', () => {
    const codeLines = Array.from({ length: 51 }, (_, i) => `line ${i + 1}`).join('\n');
    const text = '```js\n' + codeLines + '\n```';
    const issues = lintLongCodeBlock(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].line).toBe(1);
    expect(issues[0].msg).toContain('51 lines');
  });

  test('50-line block is OK with default maxLines', () => {
    const codeLines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const text = '```js\n' + codeLines + '\n```';
    const issues = lintLongCodeBlock(text);
    expect(issues).toHaveLength(0);
  });

  test('30-line block warns with maxLines=20', () => {
    const codeLines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
    const text = '```py\n' + codeLines + '\n```';
    const issues = lintLongCodeBlock(text, 20);
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('30 lines');
  });

  test('short block is OK', () => {
    const text = '```bash\necho hello\n```';
    const issues = lintLongCodeBlock(text);
    expect(issues).toHaveLength(0);
  });

  test('handles empty input', () => {
    expect(lintLongCodeBlock('')).toEqual([]);
  });
});
