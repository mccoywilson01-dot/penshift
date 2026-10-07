/**
 * BaseProvider: Abstract contract for LLM provider adapters.
 */
export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Generates a non-streaming completion.
   * @param {Object} options
   * @returns {Promise<{ text: string, usage?: Object, model: string }>}
   */
  async generate(_options) {
    throw new Error(`generate() not implemented on ${this.name}`);
  }

  /**
   * Generates a streaming completion invoking onToken for each token/sentence chunk.
   * @param {Object} _options
   * @returns {Promise<{ fullText: string, usage?: Object, model: string }>}
   */
  async stream(_options) {
    throw new Error(`stream() not implemented on ${this.name}`);
  }

  /**
   * Runs forensic text scoring returning structured JSON scores.
   * @param {Object} _options
   * @returns {Promise<{ score: number, signals: Object, model: string }>}
   */
  async score(_options) {
    throw new Error(`score() not implemented on ${this.name}`);
  }

  /**
   * Checks upstream health and availability.
   * @returns {Promise<{ healthy: boolean, latencyMs: number, error?: string }>}
   */
  async healthCheck() {
    throw new Error(`healthCheck() not implemented on ${this.name}`);
  }
}
