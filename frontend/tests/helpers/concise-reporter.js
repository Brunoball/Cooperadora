const ANSI_RE = /\u001b\[[0-9;]*m/g;

function clean(text) {
  return String(text || '').replace(ANSI_RE, '').replace(/\s+/g, ' ').trim();
}

function compactError(result) {
  const raw = result?.error?.message || result?.errors?.[0]?.message || 'Error sin detalle.';
  const lines = String(raw)
    .replace(ANSI_RE, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^at\s/.test(line) && !/^Call log:/i.test(line));

  const first = lines[0] || 'Error sin detalle.';
  const detail = lines.find((line, index) => index > 0 && /^(Locator|Expected|Received|Timeout):/i.test(line));
  return clean(detail && detail !== first ? `${first} | ${detail}` : first);
}

class ConciseReporter {
  onTestEnd(test, result) {
    const name = clean(test.title);
    if (result.status === 'passed') {
      console.log(`✓ ${name}`);
      return;
    }
    if (result.status === 'skipped') {
      console.log(`- ${name}`);
      return;
    }
    console.log(`✗ ${name}`);
    console.log(`  ${compactError(result)}`);
  }

  printsToStdio() {
    return true;
  }
}

module.exports = ConciseReporter;
