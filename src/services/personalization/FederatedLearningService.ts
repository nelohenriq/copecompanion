import { logger } from '@/lib/logger';

export interface FederatedModel {
  id: string;
  version: number;
  parameters: Record<string, number[]>;
  participantCount: number;
  lastUpdated: Date;
  accuracy: number;
  privacyBudget: number;
}

export interface LocalUpdate {
  userId: string;
  modelVersion: number;
  gradients: Record<string, number[]>;
  sampleCount: number;
  timestamp: Date;
  privacyNoise: number;
}

export interface GlobalModelUpdate {
  modelId: string;
  newParameters: Record<string, number[]>;
  participantCount: number;
  averageAccuracy: number;
  roundsCompleted: number;
}

export interface PrivacyMetrics {
  epsilon: number; // Privacy budget
  delta: number; // Failure probability
  noiseScale: number;
  clippingThreshold: number;
}

export class FederatedLearningService {
  private models: Map<string, FederatedModel> = new Map();
  private pendingUpdates: Map<string, LocalUpdate[]> = new Map();
  private privacyMetrics: Map<string, PrivacyMetrics> = new Map();

  constructor() {
    this.initializeFederatedLearning();
  }

  private initializeFederatedLearning() {
    // Initialize base models for different personalization tasks
    this.initializeBaseModels();
    logger.info('Federated learning service initialized');
  }

  private initializeBaseModels() {
    // Content preference model
    this.models.set('content-preference', {
      id: 'content-preference',
      version: 1,
      parameters: this.initializeContentPreferenceParameters(),
      participantCount: 0,
      lastUpdated: new Date(),
      accuracy: 0.5,
      privacyBudget: 1.0
    });

    // Interaction pattern model
    this.models.set('interaction-pattern', {
      id: 'interaction-pattern',
      version: 1,
      parameters: this.initializeInteractionPatternParameters(),
      participantCount: 0,
      lastUpdated: new Date(),
      accuracy: 0.5,
      privacyBudget: 1.0
    });

    // Emotional response model
    this.models.set('emotional-response', {
      id: 'emotional-response',
      version: 1,
      parameters: this.initializeEmotionalResponseParameters(),
      participantCount: 0,
      lastUpdated: new Date(),
      accuracy: 0.5,
      privacyBudget: 1.0
    });
  }

  private initializeContentPreferenceParameters(): Record<string, number[]> {
    // Initialize neural network parameters for content preference prediction
    return {
      'layer1_weights': this.randomMatrix(64, 128),
      'layer1_bias': this.randomVector(64),
      'layer2_weights': this.randomMatrix(32, 64),
      'layer2_bias': this.randomVector(32),
      'output_weights': this.randomMatrix(10, 32), // 10 content categories
      'output_bias': this.randomVector(10)
    };
  }

  private initializeInteractionPatternParameters(): Record<string, number[]> {
    // Parameters for predicting user interaction patterns
    return {
      'temporal_weights': this.randomMatrix(24, 48), // 24 hour patterns
      'behavioral_weights': this.randomMatrix(16, 24),
      'contextual_weights': this.randomMatrix(8, 16),
      'output_weights': this.randomMatrix(5, 8), // 5 interaction types
      'output_bias': this.randomVector(5)
    };
  }

  private initializeEmotionalResponseParameters(): Record<string, number[]> {
    // Parameters for emotional response prediction
    return {
      'content_embedding': this.randomMatrix(256, 512),
      'emotional_weights': this.randomMatrix(64, 256),
      'context_weights': this.randomMatrix(32, 64),
      'output_weights': this.randomMatrix(11, 32), // 11 emotion types
      'output_bias': this.randomVector(11)
    };
  }

  private randomMatrix(rows: number, cols: number): number[] {
    const matrix: number[] = [];
    for (let i = 0; i < rows * cols; i++) {
      matrix.push((Math.random() - 0.5) * 0.1); // Small random initialization
    }
    return matrix;
  }

  private randomVector(size: number): number[] {
    const vector: number[] = [];
    for (let i = 0; i < size; i++) {
      vector.push((Math.random() - 0.5) * 0.1);
    }
    return vector;
  }

  async submitLocalUpdate(update: LocalUpdate): Promise<void> {
    try {
      // Validate update
      if (!this.validateLocalUpdate(update)) {
        throw new Error('Invalid local update');
      }

      // Add privacy noise
      const noisedUpdate = await this.addPrivacyNoise(update);

      // Store update for aggregation
      const modelId = `model-${update.modelVersion}`;
      const updates = this.pendingUpdates.get(modelId) || [];
      updates.push(noisedUpdate);
      this.pendingUpdates.set(modelId, updates);

      logger.debug({
        userId: update.userId,
        modelVersion: update.modelVersion,
        sampleCount: update.sampleCount
      }, 'Local update submitted to federated learning');

      // Check if we should trigger aggregation
      if (updates.length >= this.getAggregationThreshold(modelId)) {
        await this.aggregateUpdates(modelId);
      }

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: update.userId,
        modelVersion: update.modelVersion
      }, 'Failed to submit local update');
      throw error;
    }
  }

  private validateLocalUpdate(update: LocalUpdate): boolean {
    // Validate update structure and bounds
    if (!update.gradients || typeof update.gradients !== 'object') {
      return false;
    }

    // Check gradient magnitudes (prevent poisoning attacks)
    for (const [key, gradient] of Object.entries(update.gradients)) {
      if (!Array.isArray(gradient)) return false;
      const magnitude = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
      if (magnitude > 10.0) { // Maximum allowed gradient magnitude
        logger.warn({
          userId: update.userId,
          parameter: key,
          magnitude
        }, 'Gradient magnitude too large, possible poisoning attack');
        return false;
      }
    }

    return update.sampleCount > 0 && update.sampleCount <= 1000;
  }

  private async addPrivacyNoise(update: LocalUpdate): Promise<LocalUpdate> {
    const modelId = `model-${update.modelVersion}`;
    const privacyMetrics = this.privacyMetrics.get(modelId) || {
      epsilon: 1.0,
      delta: 1e-5,
      noiseScale: 0.1,
      clippingThreshold: 1.0
    };

    const noisedGradients: Record<string, number[]> = {};

    for (const [key, gradient] of Object.entries(update.gradients)) {
      // Clip gradients
      const clippedGradient = this.clipGradient(gradient, privacyMetrics.clippingThreshold);

      // Add Gaussian noise
      const noisedGradient = clippedGradient.map(g =>
        g + this.gaussianNoise(0, privacyMetrics.noiseScale)
      );

      noisedGradients[key] = noisedGradient;
    }

    return {
      ...update,
      gradients: noisedGradients,
      privacyNoise: privacyMetrics.noiseScale
    };
  }

  private clipGradient(gradient: number[], threshold: number): number[] {
    const norm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    if (norm <= threshold) {
      return gradient;
    }

    const scale = threshold / norm;
    return gradient.map(g => g * scale);
  }

  private gaussianNoise(mean: number, std: number): number {
    // Box-Muller transform for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * std;
  }

  private getAggregationThreshold(modelId: string): number {
    // Dynamic threshold based on model and current participants
    const baseThreshold = 10; // Minimum participants for aggregation
    const model = this.models.get(modelId.replace('model-', ''));

    if (model && model.participantCount > 100) {
      return Math.max(baseThreshold, Math.floor(model.participantCount * 0.01)); // 1% of participants
    }

    return baseThreshold;
  }

  private async aggregateUpdates(modelId: string): Promise<void> {
    const updates = this.pendingUpdates.get(modelId) || [];
    if (updates.length === 0) return;

    try {
      const modelVersion = parseInt(modelId.replace('model-', ''));
      const model = this.models.get(modelVersion.toString());

      if (!model) {
        throw new Error(`Model ${modelVersion} not found`);
      }

      // Federated averaging
      const aggregatedGradients = this.federatedAveraging(updates);

      // Update global model
      const newParameters = this.applyGradients(model.parameters, aggregatedGradients);

      const updatedModel: FederatedModel = {
        ...model,
        parameters: newParameters,
        participantCount: model.participantCount + updates.length,
        lastUpdated: new Date(),
        version: model.version + 1,
        // Simplified accuracy calculation
        accuracy: Math.min(model.accuracy + 0.01, 0.95)
      };

      this.models.set(modelVersion.toString(), updatedModel);

      // Clear processed updates
      this.pendingUpdates.delete(modelId);

      // Broadcast model update to participants
      await this.broadcastModelUpdate(updatedModel);

      logger.info({
        modelId: model.id,
        newVersion: updatedModel.version,
        participants: updates.length,
        totalParticipants: updatedModel.participantCount
      }, 'Federated model updated');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        modelId
      }, 'Failed to aggregate federated updates');
    }
  }

  private federatedAveraging(updates: LocalUpdate[]): Record<string, number[]> {
    const aggregated: Record<string, number[]> = {};
    const totalSamples = updates.reduce((sum, update) => sum + update.sampleCount, 0);

    // Initialize with zeros
    const firstUpdate = updates[0];
    for (const key of Object.keys(firstUpdate.gradients)) {
      aggregated[key] = new Array(firstUpdate.gradients[key].length).fill(0);
    }

    // Weighted average of gradients
    for (const update of updates) {
      const weight = update.sampleCount / totalSamples;

      for (const [key, gradient] of Object.entries(update.gradients)) {
        for (let i = 0; i < gradient.length; i++) {
          aggregated[key][i] += gradient[i] * weight;
        }
      }
    }

    return aggregated;
  }

  private applyGradients(
    parameters: Record<string, number[]>,
    gradients: Record<string, number[]>,
    learningRate: number = 0.01
  ): Record<string, number[]> {
    const newParameters: Record<string, number[]> = {};

    for (const [key, param] of Object.entries(parameters)) {
      const gradient = gradients[key];
      if (gradient) {
        newParameters[key] = param.map((p, i) => p - learningRate * gradient[i]);
      } else {
        newParameters[key] = [...param];
      }
    }

    return newParameters;
  }

  private async broadcastModelUpdate(model: FederatedModel): Promise<void> {
    // In a real implementation, this would broadcast to connected clients
    // For now, just log the update
    logger.debug({
      modelId: model.id,
      version: model.version,
      participantCount: model.participantCount
    }, 'Model update broadcasted');
  }

  async getPersonalizedModel(userId: string, modelType: string): Promise<FederatedModel | null> {
    const model = this.models.get(modelType);
    return model || null;
  }

  async predictWithFederatedModel(
    modelType: string,
    input: number[]
  ): Promise<number[]> {
    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Model ${modelType} not found`);
    }

    // Simple forward pass (simplified neural network)
    return this.forwardPass(model.parameters, input);
  }

  private forwardPass(parameters: Record<string, number[]>, input: number[]): number[] {
    // Simplified forward pass - in reality this would be more complex
    let activations = input;

    // Layer 1
    if (parameters.layer1_weights && parameters.layer1_bias) {
      activations = this.matrixMultiply(parameters.layer1_weights, activations);
      activations = this.addBias(activations, parameters.layer1_bias);
      activations = activations.map(this.relu);
    }

    // Layer 2
    if (parameters.layer2_weights && parameters.layer2_bias) {
      activations = this.matrixMultiply(parameters.layer2_weights, activations);
      activations = this.addBias(activations, parameters.layer2_bias);
      activations = activations.map(this.relu);
    }

    // Output layer
    if (parameters.output_weights && parameters.output_bias) {
      activations = this.matrixMultiply(parameters.output_weights, activations);
      activations = this.addBias(activations, parameters.output_bias);
      activations = this.softmax(activations);
    }

    return activations;
  }

  private matrixMultiply(matrix: number[], vector: number[]): number[] {
    const rows = matrix.length / vector.length;
    const result: number[] = new Array(rows).fill(0);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < vector.length; j++) {
        result[i] += matrix[i * vector.length + j] * vector[j];
      }
    }

    return result;
  }

  private addBias(activations: number[], bias: number[]): number[] {
    return activations.map((a, i) => a + (bias[i] || 0));
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exps = values.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(exp => exp / sum);
  }

  getPrivacyMetrics(modelType: string): PrivacyMetrics | null {
    return this.privacyMetrics.get(modelType) || null;
  }

  async updatePrivacyMetrics(modelType: string, metrics: Partial<PrivacyMetrics>): Promise<void> {
    const current = this.privacyMetrics.get(modelType) || {
      epsilon: 1.0,
      delta: 1e-5,
      noiseScale: 0.1,
      clippingThreshold: 1.0
    };

    this.privacyMetrics.set(modelType, { ...current, ...metrics });

    logger.info({
      modelType,
      metrics: { ...current, ...metrics }
    }, 'Privacy metrics updated');
  }

  getModelStats(): Record<string, {
    version: number;
    participants: number;
    accuracy: number;
    lastUpdated: Date;
  }> {
    const stats: Record<string, any> = {};

    for (const [id, model] of this.models) {
      stats[id] = {
        version: model.version,
        participants: model.participantCount,
        accuracy: model.accuracy,
        lastUpdated: model.lastUpdated
      };
    }

    return stats;
  }
}