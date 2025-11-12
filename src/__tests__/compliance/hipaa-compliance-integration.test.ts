import { HIPAAComplianceService } from '@/services/compliance/HIPAAComplianceService';
import { EncryptionService } from '@/services/security/EncryptionService';

describe('HIPAA Compliance Integration', () => {
  let complianceService: HIPAAComplianceService;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    complianceService = new HIPAAComplianceService();
    encryptionService = new EncryptionService();
  });

  describe('Compliance Status Monitoring', () => {
    test('should generate accurate compliance status', async () => {
      const status = await complianceService.getComplianceStatus();

      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('riskScore');
      expect(status).toHaveProperty('criticalIssues');
      expect(status).toHaveProperty('warnings');
      expect(status.riskScore).toBeGreaterThanOrEqual(0);
      expect(status.riskScore).toBeLessThanOrEqual(100);
    });

    test('should include compliance issues in status', async () => {
      const status = await complianceService.getComplianceStatus();

      expect(Array.isArray(status.criticalIssues)).toBe(true);
      expect(Array.isArray(status.warnings)).toBe(true);
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate comprehensive compliance report', async () => {
      const startDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
      const endDate = new Date();

      const report = await complianceService.generateComplianceReport(startDate, endDate, 'test-user');

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('sections');
      expect(report).toHaveProperty('overallScore');
      expect(report.sections.length).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });

    test('should include all required compliance sections', async () => {
      const startDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      const endDate = new Date();

      const report = await complianceService.generateComplianceReport(startDate, endDate, 'test-user');

      const sectionCategories = report.sections.map(s => s.category);
      expect(sectionCategories).toContain('encryption');
      expect(sectionCategories).toContain('audit');
      expect(sectionCategories).toContain('access_control');
      expect(sectionCategories).toContain('data_retention');
      expect(sectionCategories).toContain('breach_detection');
    });
  });

  describe('Encryption Service Integration', () => {
    test('should encrypt and decrypt PHI data correctly', async () => {
      const testData = 'This is sensitive PHI data that must be encrypted';
      const classification = await encryptionService.getDataClassification('medical_history');

      expect(classification.encryptionRequired).toBe(true);
      expect(classification.level).toBe('phi');

      const encrypted = await encryptionService.encryptData(testData, classification);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('keyId');
      expect(encrypted.ciphertext).not.toBe(testData);

      const decrypted = await encryptionService.decryptData(encrypted);
      expect(decrypted).toBe(testData);
    });

    test('should handle different data classifications', async () => {
      const classifications = [
        { type: 'medical_history', expectedLevel: 'phi' as const },
        { type: 'user_profile', expectedLevel: 'confidential' as const },
        { type: 'audit_log', expectedLevel: 'restricted' as const },
        { type: 'public_content', expectedLevel: 'public' as const }
      ];

      for (const { type, expectedLevel } of classifications) {
        const classification = await encryptionService.getDataClassification(type);
        expect(classification.level).toBe(expectedLevel);
      }
    });

    test('should encrypt and decrypt object fields', async () => {
      const testObject = {
        name: 'John Doe',
        medicalHistory: 'Patient has depression and anxiety',
        email: 'john@example.com',
        auditLog: 'User accessed medical records'
      };

      const fieldsToEncrypt = ['medicalHistory', 'auditLog'];
      const encrypted = await encryptionService.encryptObject(testObject, fieldsToEncrypt);

      expect(encrypted.medicalHistory).toHaveProperty('ciphertext');
      expect(encrypted.auditLog).toHaveProperty('ciphertext');
      expect(encrypted.name).toBe(testObject.name); // Not encrypted
      expect(encrypted.email).toBe(testObject.email); // Not encrypted

      const decrypted = await encryptionService.decryptObject(encrypted, fieldsToEncrypt);
      expect(decrypted.medicalHistory).toBe(testObject.medicalHistory);
      expect(decrypted.auditLog).toBe(testObject.auditLog);
      expect(decrypted.name).toBe(testObject.name);
      expect(decrypted.email).toBe(testObject.email);
    });
  });

  describe('Key Management', () => {
    test('should track key rotation status', () => {
      const status = encryptionService.getKeyRotationStatus();

      expect(status).toHaveProperty('daysUntilExpiration');
      expect(status).toHaveProperty('needsRotation');
      expect(typeof status.daysUntilExpiration).toBe('number');
      expect(typeof status.needsRotation).toBe('boolean');
    });

    test('should provide encryption statistics', () => {
      const stats = encryptionService.getEncryptionStats();

      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('activeKeys');
      expect(stats).toHaveProperty('currentKeyId');
      expect(stats).toHaveProperty('lastRotation');
      expect(stats.totalKeys).toBeGreaterThan(0);
      expect(stats.activeKeys).toBeGreaterThan(0);
    });

    test('should validate encryption integrity', async () => {
      const isValid = await encryptionService.validateEncryptionIntegrity();
      expect(isValid).toBe(true);
    });
  });

  describe('Business Associate Agreements', () => {
    test('should track BAA compliance', () => {
      const agreements = complianceService.getBusinessAssociateAgreements();

      expect(Array.isArray(agreements)).toBe(true);
      if (agreements.length > 0) {
        const agreement = agreements[0];
        expect(agreement).toHaveProperty('id');
        expect(agreement).toHaveProperty('partnerName');
        expect(agreement).toHaveProperty('status');
        expect(agreement).toHaveProperty('expirationDate');
      }
    });

    test('should add new business associate agreement', async () => {
      const newBAA = {
        partnerName: 'Test Analytics Provider',
        partnerType: 'analytics' as const,
        agreementDate: new Date(),
        expirationDate: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)),
        status: 'active' as const,
        contactPerson: 'Compliance Officer',
        contactEmail: 'compliance@test.com',
        servicesProvided: ['Analytics', 'Reporting'],
        dataShared: ['Aggregated Usage Data'],
        securityRequirements: ['Data encryption', 'Access controls'],
        lastReviewed: new Date(),
        nextReviewDue: new Date(Date.now() + (180 * 24 * 60 * 60 * 1000))
      };

      const baaId = await complianceService.addBusinessAssociateAgreement(newBAA);
      expect(typeof baaId).toBe('string');
      expect(baaId).toContain('baa-');

      const agreements = complianceService.getBusinessAssociateAgreements();
      const addedAgreement = agreements.find(a => a.id === baaId);
      expect(addedAgreement).toBeDefined();
      expect(addedAgreement!.partnerName).toBe(newBAA.partnerName);
    });
  });

  describe('Staff Training Compliance', () => {
    test('should track staff training records', () => {
      const records = complianceService.getStaffTrainingRecords();
      expect(Array.isArray(records)).toBe(true);
    });

    test('should record staff training completion', async () => {
      const training = {
        userId: 'user-123',
        userName: 'Jane Smith',
        trainingType: 'hipaa_basics' as const,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)),
        status: 'completed' as const,
        score: 95
      };

      const trainingId = await complianceService.recordStaffTraining(training);
      expect(typeof trainingId).toBe('string');
      expect(trainingId).toContain('training-');

      const records = complianceService.getStaffTrainingRecords();
      const addedRecord = records.find(r => r.id === trainingId);
      expect(addedRecord).toBeDefined();
      expect(addedRecord!.userName).toBe(training.userName);
      expect(addedRecord!.score).toBe(training.score);
    });
  });

  describe('Automated Compliance Monitoring', () => {
    test('should run compliance checks without errors', async () => {
      // This should not throw any errors
      await expect(complianceService.runComplianceCheck()).resolves.not.toThrow();
    });

    test('should create compliance issues for violations', async () => {
      const initialIssues = complianceService.getComplianceIssues().length;

      // Add an expired BAA to trigger compliance issue
      const expiredBAA = {
        partnerName: 'Expired Test Provider',
        partnerType: 'cloud_provider' as const,
        agreementDate: new Date(Date.now() - (400 * 24 * 60 * 60 * 1000)), // 400 days ago
        expirationDate: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)), // 30 days ago (expired)
        status: 'expired' as const,
        contactPerson: 'Test Contact',
        contactEmail: 'test@expired.com',
        servicesProvided: ['Storage'],
        dataShared: ['PHI'],
        securityRequirements: ['Encryption'],
        lastReviewed: new Date(Date.now() - (200 * 24 * 60 * 60 * 1000)),
        nextReviewDue: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
      };

      await complianceService.addBusinessAssociateAgreement(expiredBAA);

      // Run compliance check
      await complianceService.runComplianceCheck();

      const finalIssues = complianceService.getComplianceIssues().length;
      expect(finalIssues).toBeGreaterThan(initialIssues);
    });
  });
});