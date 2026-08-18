import { describe, test, expect } from 'bun:test';
import {
  forEachNonCodeLine,
  lintBrandNames, lintBareUrls,
  lintUnclosedCodeFence, lintCodeBlockLanguage,
  lintEmDash, lintPlaceholderText,
  lintEmptyImageAlt, lintLongCodeBlock,
  type LintMessage,
} from '../src/lint.ts';

// ─── lintBrandNames ──────────────────────────────────────────────────────────

describe('lintBrandNames', () => {
  test.each([
    ['Redhat', 'We use Redhat Enterprise Linux.', 'Red Hat'],
    ['openshift', 'Deploy on openshift today', 'OpenShift'],
    ['kubernetes', 'Running on kubernetes cluster.', 'Kubernetes'],
    ['ansible', 'Use ansible for automation.', 'Ansible'],
    ['Rhel', 'Install Rhel on bare metal.', 'RHEL'],
    ['fedora', 'Run fedora workstation.', 'Fedora'],
    ['podman', 'Use podman for containers.', 'Podman'],
    ['Centos', 'Upgrade from Centos to RHEL.', 'CentOS'],
    ['centos', 'Upgrade from centos to RHEL.', 'CentOS'],
  ])('detects "%s" misspelling → %s', (_wrong, input, correct) => {
    const issues = lintBrandNames(input);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warn');
    expect(issues[0].msg).toContain(correct);
  });

  test.each([
    ['Red Hat', 'We use Red Hat Enterprise Linux.'],
    ['OpenShift', 'Deploy on OpenShift.'],
    ['RHEL', 'Install RHEL on bare metal.'],
    ['Fedora', 'Run Fedora workstation.'],
    ['Podman', 'Use Podman for containers.'],
    ['CentOS', 'Upgrade from CentOS to RHEL.'],
  ])('accepts correct "%s" spelling', (_brand, input) => {
    expect(lintBrandNames(input)).toHaveLength(0);
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

  test('does not flag URL inside inline code', () => {
    const issues = lintBareUrls('Use `https://docs.example.com/api/endpoint` as the base URL.');
    expect(issues).toHaveLength(0);
  });

  test('detects multiple bare URLs on a single line', () => {
    const issues = lintBareUrls(
      'Visit https://docs.example.com/path and https://other.example.com/path today.',
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].level).toBe('warn');
    expect(issues[1].level).toBe('warn');
  });

  test('does not flag short URL after stripping trailing punctuation', () => {
    // "http://example.com." — after stripping ".", URL becomes 18 chars → ≤20 → skip
    const issues = lintBareUrls('See http://example.com.');
    expect(issues).toHaveLength(0);
  });

  test('strips trailing period from bare URL before checking', () => {
    // The URL without trailing period is still long enough to flag
    const issues = lintBareUrls('Visit https://docs.example.com/some/path.');
    expect(issues).toHaveLength(1);
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

  test.each([
    ['FIXME', 'FIXME: broken link'],
    ['XXX', 'XXX needs review'],
    ['PLACEHOLDER', 'This is placeholder text'],
  ])('detects %s', (ph, text) => {
    const issues = lintPlaceholderText(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain(ph);
  });

  test('handles empty input', () => {
    expect(lintPlaceholderText('')).toEqual([]);
  });

  test('does not false-positive on "Todorov" (substring of TODO)', () => {
    const issues = lintPlaceholderText('Author: Todorov');
    expect(issues).toHaveLength(0);
  });

  test('does not false-positive on "XXXL" (substring of XXX)', () => {
    const issues = lintPlaceholderText('Available in sizes S, M, L, XXXL.');
    expect(issues).toHaveLength(0);
  });

  test('still detects standalone TODO in a sentence', () => {
    const issues = lintPlaceholderText('This is a TODO item.');
    expect(issues).toHaveLength(1);
    expect(issues[0].msg).toContain('TODO');
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

// ─── forEachNonCodeLine ─────────────────────────────────────────────────────

describe('forEachNonCodeLine', () => {
  test('iterates over plain lines', () => {
    const collected: Array<[string, number]> = [];
    forEachNonCodeLine('alpha\nbeta\ngamma', (line, num) => collected.push([line, num]));
    expect(collected).toEqual([
      ['alpha', 1],
      ['beta', 2],
      ['gamma', 3],
    ]);
  });

  test('skips content inside ``` fences', () => {
    const collected: string[] = [];
    forEachNonCodeLine('before\n```\ncode line\n```\nafter', (line) => collected.push(line));
    expect(collected).toEqual(['before', 'after']);
  });

  test('skips content inside ~~~ fences', () => {
    const collected: string[] = [];
    forEachNonCodeLine('before\n~~~\ntilde code\n~~~\nafter', (line) => collected.push(line));
    expect(collected).toEqual(['before', 'after']);
  });

  test('handles mixed ``` and ~~~ fences', () => {
    const text = 'A\n```\ncode1\n```\nB\n~~~\ncode2\n~~~\nC';
    const collected: string[] = [];
    forEachNonCodeLine(text, (line) => collected.push(line));
    expect(collected).toEqual(['A', 'B', 'C']);
  });

  test('normalizes CRLF to LF', () => {
    const collected: Array<[string, number]> = [];
    forEachNonCodeLine('one\r\ntwo\r\nthree', (line, num) => collected.push([line, num]));
    expect(collected).toEqual([
      ['one', 1],
      ['two', 2],
      ['three', 3],
    ]);
  });

  test('handles empty input', () => {
    const collected: string[] = [];
    forEachNonCodeLine('', (line) => collected.push(line));
    // empty string splits into one empty-string element
    expect(collected).toEqual(['']);
  });

  test('fence-only document yields no callbacks', () => {
    const collected: string[] = [];
    forEachNonCodeLine('```\nsome code\n```', (line) => collected.push(line));
    expect(collected).toEqual([]);
  });

  test('line numbers are 1-based', () => {
    const nums: number[] = [];
    forEachNonCodeLine('first\nsecond\nthird', (_line, num) => nums.push(num));
    expect(nums).toEqual([1, 2, 3]);
  });

  test('fence lines themselves are not emitted', () => {
    const collected: string[] = [];
    forEachNonCodeLine('```js\nconsole.log("hi")\n```', (line) => collected.push(line));
    expect(collected).toEqual([]);
  });

  test('mismatched fence types do not close each other', () => {
    // ~~~ block contains a ``` line that must NOT close the fence
    const text = '~~~\ncode\n```\nmore code\n~~~\nvisible';
    const collected: string[] = [];
    forEachNonCodeLine(text, (line) => collected.push(line));
    expect(collected).toEqual(['visible']);
  });

  test('shorter backtick fence does not close longer opening fence', () => {
    // ````` block contains a ``` line that must NOT close it (CommonMark spec)
    const text = 'before\n`````\ncode\n```\nstill code\n`````\nafter';
    const collected: string[] = [];
    forEachNonCodeLine(text, (line) => collected.push(line));
    expect(collected).toEqual(['before', 'after']);
  });

  test('longer backtick fence can close shorter opening fence', () => {
    // ``` block can be closed by ````` (closing ≥ opening length)
    const text = 'before\n```\ncode\n`````\nafter';
    const collected: string[] = [];
    forEachNonCodeLine(text, (line) => collected.push(line));
    expect(collected).toEqual(['before', 'after']);
  });

  test('shorter tilde fence does not close longer opening fence', () => {
    const text = 'before\n~~~~~\ncode\n~~~\nstill code\n~~~~~\nafter';
    const collected: string[] = [];
    forEachNonCodeLine(text, (line) => collected.push(line));
    expect(collected).toEqual(['before', 'after']);
  });
});
