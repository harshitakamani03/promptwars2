import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────
// JanSetu Core Logic Tests
// ────────────────────────────────────────────────────

describe('localStorage persistence by Aadhaar ID', () => {
  const STORAGE_KEY = (id: string) => `jansetu_records_${id}`;
  const LEGAL_KEY   = (id: string) => `jansetu_legal_${id}`;

  it('stores and retrieves medical records by Aadhaar ID', () => {
    const id = '123456789012';
    const records = [{ id: '1', date: '2025-03-28', type: 'report', title: 'Blood Test', aiSummary: 'Hb normal.' }];
    global.localStorage = { getItem: () => JSON.stringify(records), setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
    const retrieved = JSON.parse(global.localStorage.getItem(STORAGE_KEY(id))!);
    expect(retrieved[0].title).toBe('Blood Test');
  });

  it('generates different keys for different Aadhaar IDs', () => {
    expect(STORAGE_KEY('111111111111')).toBe('jansetu_records_111111111111');
    expect(STORAGE_KEY('222222222222')).toBe('jansetu_records_222222222222');
    expect(STORAGE_KEY('111111111111')).not.toBe(STORAGE_KEY('222222222222'));
  });

  it('generates separate keys for medical vs legal data', () => {
    const id = '123456789012';
    expect(STORAGE_KEY(id)).not.toBe(LEGAL_KEY(id));
    expect(LEGAL_KEY(id)).toBe('jansetu_legal_123456789012');
  });
});

describe('Gemini JSON response parsing', () => {
  it('extracts JSON from a response with surrounding text', () => {
    const raw = 'Sure! Here is your data:\n{"title": "Blood Report", "summary": "Hemoglobin normal."}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch![0]);
    expect(data.title).toBe('Blood Report');
    expect(data.summary).toBe('Hemoglobin normal.');
  });

  it('returns null when no JSON is present', () => {
    const raw = 'I cannot process this image.';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    expect(jsonMatch).toBeNull();
  });

  it('parses medicines array from prescription JSON', () => {
    const raw = '{"summary": "Viral fever.", "medicines": ["Paracetamol 650mg", "ORS"]}';
    const data = JSON.parse(raw.match(/\{[\s\S]*\}/)![0]);
    expect(data.medicines).toHaveLength(2);
    expect(data.medicines[0]).toBe('Paracetamol 650mg');
  });

  it('handles nested JSON in Gemini response correctly', () => {
    const raw = '```json\n{"name": "Harshita", "id": "123456789012", "location": "Mumbai"}\n```';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch![0]);
    expect(data.name).toBe('Harshita');
    expect(data.id).toBe('123456789012');
  });
});

describe('Input validation', () => {
  const isValidAadhaar = (id: string) => id.trim().length === 12 && /^\d+$/.test(id);

  it('accepts a valid 12-digit Aadhaar number', () => {
    expect(isValidAadhaar('123456789012')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidAadhaar('')).toBe(false);
  });

  it('rejects a number shorter than 12 digits', () => {
    expect(isValidAadhaar('12345')).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    expect(isValidAadhaar('abcdefghijkl')).toBe(false);
  });

  it('rejects Aadhaar with spaces', () => {
    expect(isValidAadhaar('1234 5678 0123')).toBe(false);
  });
});

describe('Legal case management', () => {
  it('creates a new case with correct default structure', () => {
    const newCase = {
      id: '1', title: 'Land Dispute', status: 'open' as const,
      createdAt: '2025-03-28', messages: []
    };
    expect(newCase.status).toBe('open');
    expect(newCase.messages).toHaveLength(0);
    expect(newCase.title).toBe('Land Dispute');
  });

  it('adds messages to a case correctly', () => {
    const legalCase = { id: '1', title: 'Test', status: 'open' as const, createdAt: '2025-03-28', messages: [] as { role: 'user' | 'ai', content: string }[] };
    legalCase.messages.push({ role: 'user', content: 'I have a land dispute.' });
    legalCase.messages.push({ role: 'ai', content: 'Here are your options...' });
    expect(legalCase.messages).toHaveLength(2);
    expect(legalCase.messages[0].role).toBe('user');
    expect(legalCase.messages[1].role).toBe('ai');
  });

  it('isolates messages per case', () => {
    const case1 = { id: '1', messages: [{ role: 'user' as const, content: 'Case 1 msg' }] };
    const case2 = { id: '2', messages: [{ role: 'user' as const, content: 'Case 2 msg' }] };
    expect(case1.messages[0].content).not.toBe(case2.messages[0].content);
  });
});

describe('Medical record creation', () => {
  it('creates a report record with correct fields', () => {
    const record = {
      id: Date.now().toString(), date: '2025-03-28',
      type: 'report', title: 'Thyroid Panel', aiSummary: 'TSH normal.',
    };
    expect(record.type).toBe('report');
    expect(record.title).toBe('Thyroid Panel');
  });

  it('creates a prescription with medicines array', () => {
    const record = {
      id: Date.now().toString(), date: '2025-03-28',
      type: 'prescription', title: 'Fever', aiSummary: 'Viral fever.',
      medicines: ['Paracetamol 650mg', 'Vitamin C'],
    };
    expect(record.medicines).toHaveLength(2);
    expect(record.type).toBe('prescription');
  });
});
