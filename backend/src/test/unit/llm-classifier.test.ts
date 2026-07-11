import * as http from 'http';
import { classifyWithLlm, llmScoreToSpamPoints, LlmConfig } from '../../spam/llm-classifier';

function startMockOllama(handler: (body: string) => { status: number; response?: string }) {
  return new Promise<http.Server>((resolve) => {
    const server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        const out = handler(data);
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: out.response ?? '' }));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const port = (s: http.Server) => (s.address() as import('net').AddressInfo).port;
const cfg = (endpoint: string): LlmConfig => ({ enabled: true, endpoint, model: 'llama3', timeoutMs: 3000 });

describe('LLM phishing classifier', () => {
  it('parses a valid JSON verdict from Ollama', async () => {
    const server = await startMockOllama(() => ({
      status: 200,
      response: 'Sure: {"score": 9, "reason": "fake bank login"}',
    }));
    try {
      const v = await classifyWithLlm(cfg(`http://127.0.0.1:${port(server)}`), 'Ihr Konto', 'Klicken Sie hier');
      expect(v).not.toBeNull();
      expect(v!.score).toBe(9);
      expect(v!.reason).toContain('bank');
    } finally {
      server.close();
    }
  });

  it('is fail-open (returns null) when Ollama is unreachable', async () => {
    const v = await classifyWithLlm(cfg('http://127.0.0.1:1'), 's', 'b');
    expect(v).toBeNull();
  });

  it('is fail-open when the response is not parseable', async () => {
    const server = await startMockOllama(() => ({ status: 200, response: 'no json here' }));
    try {
      const v = await classifyWithLlm(cfg(`http://127.0.0.1:${port(server)}`), 's', 'b');
      expect(v).toBeNull();
    } finally {
      server.close();
    }
  });

  it('returns null immediately when disabled', async () => {
    const v = await classifyWithLlm({ enabled: false, endpoint: 'http://x', model: 'llama3', timeoutMs: 1000 }, 's', 'b');
    expect(v).toBeNull();
  });

  it('maps scores to spam points with correct thresholds', () => {
    expect(llmScoreToSpamPoints(9)).toBe(12);
    expect(llmScoreToSpamPoints(6)).toBe(7);
    expect(llmScoreToSpamPoints(4)).toBe(3);
    expect(llmScoreToSpamPoints(2)).toBe(0);
  });

  it('clamps out-of-range scores', async () => {
    const server = await startMockOllama(() => ({ status: 200, response: '{"score": 99, "reason": "x"}' }));
    try {
      const v = await classifyWithLlm(cfg(`http://127.0.0.1:${port(server)}`), 's', 'b');
      expect(v!.score).toBe(10);
    } finally {
      server.close();
    }
  });
});
