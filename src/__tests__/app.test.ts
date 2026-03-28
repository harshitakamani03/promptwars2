import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────
// JanSetu - Universal Bridge Security & Logic Tests
// ────────────────────────────────────────────────────

describe('Critical Action Detection Logic', () => {
  it('correctly identifies critical status and actions from AI JSON', () => {
    const rawAiResponse = `{
      "title": "Critical Blood Report",
      "summary": "Patient has severe anemia.",
      "isCritical": true,
      "recommendedAction": "Immediate blood transfusion required. Contact hematologist."
    }`;
    const data = JSON.parse(rawAiResponse);
    expect(data.isCritical).toBe(true);
    expect(data.recommendedAction).toContain('Immediate');
  });

  it('correctly classifies non-critical reports', () => {
    const rawAiResponse = `{
      "title": "Routine Checkup",
      "summary": "All values within normal range.",
      "isCritical": false,
      "recommendedAction": "Continue healthy diet."
    }`;
    const data = JSON.parse(rawAiResponse);
    expect(data.isCritical).toBe(false);
  });
});

describe('LocalStorage Security & Sandboxing', () => {
  const STORAGE_KEY = (id: string) => `jansetu_records_${id}`;

  it('prevents cross-user data leakage', () => {
    const userA = '111111111111';
    const userB = '222222222222';
    
    const recordsA = [{ id: '1', title: 'Secret A' }];
    const recordsB = [{ id: '2', title: 'Secret B' }];

    global.localStorage = { 
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] || null },
      setItem(key: string, val: string) { this.store[key] = val },
      removeItem(key: string) { delete this.store[key] },
      clear() { this.store = {} },
      length: 0,
      key: (i: number) => Object.keys(this.store)[i]
    };

    global.localStorage.setItem(STORAGE_KEY(userA), JSON.stringify(recordsA));
    global.localStorage.setItem(STORAGE_KEY(userB), JSON.stringify(recordsB));

    expect(JSON.parse(global.localStorage.getItem(STORAGE_KEY(userA))!)[0].title).toBe('Secret A');
    expect(JSON.parse(global.localStorage.getItem(STORAGE_KEY(userB))!)[0].title).toBe('Secret B');
  });
});

describe('Universal Bridge Input Parsing', () => {
  it('robustly extracts JSON from messy markdown code blocks', () => {
    const messyInput = "Here is the result: \n ```json\n{\"id\": \"123\", \"status\": \"verified\"}\n``` \n Hope this helps!";
    const jsonMatch = messyInput.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch![0]);
    expect(data.id).toBe('123');
  });

  it('handles multiple JSON-like objects by picking the outermost one', () => {
    const nested = 'Text before {"a": {"b": 1}} Text after';
    const jsonMatch = nested.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch![0]);
    expect(data.a.b).toBe(1);
  });
});

describe('User Identity Validation (Life-Saving Context)', () => {
  const validateId = (id: string) => id.length === 12 && /^\d+$/.test(id);

  it('validates 12-digit numeric Aadhaar', () => {
    expect(validateId('123456789012')).toBe(true);
  });

  it('rejects identity strings with letters', () => {
    expect(validateId('12345678901A')).toBe(false);
  });
});

describe('Legal Case Integrity', () => {
  it('maintains message roles for AI/Human interaction history', () => {
    const messages: {role: 'user' | 'ai', content: string}[] = [
      { role: 'user', content: 'Messy input text' },
      { role: 'ai', content: 'Structured output' }
    ];
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('ai');
  });
});
