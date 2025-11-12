import { logger } from '@/lib/logger';

export interface Professional {
  id: string;
  email: string;
  name: string;
  title: string;
  licenseNumber: string;
  certifications: string[];
  specialties: string[];
  languages: string[];
  timezone: string;
  location: {
    country: string;
    state?: string;
    city?: string;
  };
  availability: ProfessionalAvailability;
  contactMethods: {
    sms?: string;
    email: string;
    pushToken?: string;
    appId?: string;
  };
  workload: {
    currentCases: number;
    maxCases: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  rating: {
    overall: number;
    crisisResponse: number;
    totalCases: number;
  };
  status: 'active' | 'inactive' | 'on_leave' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalAvailability {
  schedule: AvailabilitySlot[];
  currentStatus: 'available' | 'busy' | 'unavailable' | 'in_crisis';
  lastUpdated: Date;
  overrideUntil?: Date;
  emergencyContact: boolean;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  timezone: string;
}

export interface CrisisMatchCriteria {
  crisisType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userLocation?: {
    country: string;
    state?: string;
    timezone: string;
  };
  requiredLanguages: string[];
  preferredSpecialties: string[];
  maxResponseTime: number; // minutes
}

export interface ProfessionalMatch {
  professional: Professional;
  score: number;
  estimatedResponseTime: number; // minutes
  reasoning: string[];
  availability: {
    immediately: boolean;
    nextAvailable: Date;
  };
}

export class ProfessionalNetworkService {
  private professionals: Map<string, Professional> = new Map();
  private availabilityCache: Map<string, ProfessionalAvailability> = new Map();

  constructor() {
    this.initializeDefaultProfessionals();
  }

  private initializeDefaultProfessionals() {
    // Initialize with sample professionals for development
    // In production, this would be loaded from database
    const sampleProfessionals: Professional[] = [
      {
        id: 'prof-001',
        email: 'dr.smith@copecompanion.org',
        name: 'Dr. Sarah Smith',
        title: 'Licensed Clinical Psychologist',
        licenseNumber: 'PSY12345',
        certifications: ['LCP', 'Crisis Intervention Certified'],
        specialties: ['suicide_prevention', 'depression', 'anxiety', 'trauma'],
        languages: ['English', 'Spanish'],
        timezone: 'America/New_York',
        location: {
          country: 'US',
          state: 'NY',
          city: 'New York'
        },
        availability: {
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
            { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' }
          ],
          currentStatus: 'available',
          lastUpdated: new Date(),
          emergencyContact: true
        },
        contactMethods: {
          sms: '+1234567890',
          email: 'dr.smith@copecompanion.org',
          pushToken: 'push-token-123',
          appId: 'app-001'
        },
        workload: {
          currentCases: 2,
          maxCases: 5,
          priority: 'high'
        },
        rating: {
          overall: 4.8,
          crisisResponse: 4.9,
          totalCases: 150
        },
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'prof-002',
        email: 'dr.johnson@copecompanion.org',
        name: 'Dr. Michael Johnson',
        title: 'Licensed Clinical Social Worker',
        licenseNumber: 'LCSW67890',
        certifications: ['LCSW', 'Trauma-Informed Care'],
        specialties: ['ptsd', 'domestic_violence', 'substance_abuse', 'crisis_intervention'],
        languages: ['English', 'French'],
        timezone: 'America/Los_Angeles',
        location: {
          country: 'US',
          state: 'CA',
          city: 'Los Angeles'
        },
        availability: {
          schedule: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', timezone: 'America/Los_Angeles' },
            { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', timezone: 'America/Los_Angeles' },
            { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', timezone: 'America/Los_Angeles' },
            { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', timezone: 'America/Los_Angeles' },
            { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', timezone: 'America/Los_Angeles' }
          ],
          currentStatus: 'available',
          lastUpdated: new Date(),
          emergencyContact: true
        },
        contactMethods: {
          sms: '+1987654321',
          email: 'dr.johnson@copecompanion.org',
          pushToken: 'push-token-456',
          appId: 'app-002'
        },
        workload: {
          currentCases: 1,
          maxCases: 4,
          priority: 'high'
        },
        rating: {
          overall: 4.7,
          crisisResponse: 4.8,
          totalCases: 120
        },
        status: 'active',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date()
      }
    ];

    sampleProfessionals.forEach(prof => {
      this.professionals.set(prof.id, prof);
      this.availabilityCache.set(prof.id, prof.availability);
    });

    logger.info({
      count: sampleProfessionals.length
    }, 'Professional network initialized with sample data');
  }

  async findBestMatch(criteria: CrisisMatchCriteria): Promise<ProfessionalMatch[]> {
    try {
      const availableProfessionals = this.getAvailableProfessionals();

      const matches: ProfessionalMatch[] = [];

      for (const professional of availableProfessionals) {
        const match = this.evaluateProfessionalMatch(professional, criteria);
        if (match.score > 0) {
          matches.push(match);
        }
      }

      // Sort by score (highest first) and response time (lowest first)
      matches.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return a.estimatedResponseTime - b.estimatedResponseTime;
      });

      logger.info({
        criteria: criteria.crisisType,
        severity: criteria.severity,
        matchesFound: matches.length,
        topScore: matches[0]?.score || 0
      }, 'Professional matching completed');

      return matches.slice(0, 5); // Return top 5 matches

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        criteria: criteria.crisisType
      }, 'Professional matching failed');

      return [];
    }
  }

  private getAvailableProfessionals(): Professional[] {
    return Array.from(this.professionals.values()).filter(prof => {
      if (prof.status !== 'active') return false;

      const availability = this.availabilityCache.get(prof.id);
      if (!availability) return false;

      // Check current status
      if (availability.currentStatus === 'unavailable') return false;

      // Check schedule
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: prof.timezone
      }).substring(0, 5); // HH:MM format

      const isWithinSchedule = availability.schedule.some(slot => {
        return slot.dayOfWeek === currentDay &&
               currentTime >= slot.startTime &&
               currentTime <= slot.endTime;
      });

      // Check workload capacity
      const hasCapacity = prof.workload.currentCases < prof.workload.maxCases;

      return isWithinSchedule && hasCapacity && availability.currentStatus === 'available';
    });
  }

  private evaluateProfessionalMatch(
    professional: Professional,
    criteria: CrisisMatchCriteria
  ): ProfessionalMatch {
    let score = 0;
    const reasoning: string[] = [];
    let estimatedResponseTime = 5; // Base 5 minutes

    // Specialty matching (40% weight)
    const specialtyMatch = criteria.preferredSpecialties.some(spec =>
      professional.specialties.includes(spec)
    );
    if (specialtyMatch) {
      score += 40;
      reasoning.push(`Specialty match: ${criteria.preferredSpecialties.join(', ')}`);
    } else {
      // Partial credit for related specialties
      score += 10;
      reasoning.push('Partial specialty alignment');
    }

    // Language matching (20% weight)
    const languageMatch = criteria.requiredLanguages.every(lang =>
      professional.languages.includes(lang)
    );
    if (languageMatch) {
      score += 20;
      reasoning.push(`Language match: ${criteria.requiredLanguages.join(', ')}`);
    } else {
      reasoning.push('Language mismatch - may require interpreter');
      estimatedResponseTime += 10; // Additional time for translation
    }

    // Geographic/timezone matching (15% weight)
    if (criteria.userLocation) {
      const timezoneMatch = professional.timezone === criteria.userLocation.timezone;
      const countryMatch = professional.location.country === criteria.userLocation.country;

      if (timezoneMatch && countryMatch) {
        score += 15;
        reasoning.push('Geographic and timezone match');
      } else if (countryMatch) {
        score += 10;
        reasoning.push('Country match (timezone difference)');
        estimatedResponseTime += 5;
      } else {
        score += 5;
        reasoning.push('Geographic distance may affect response time');
        estimatedResponseTime += 15;
      }
    }

    // Crisis response rating (10% weight)
    const ratingScore = (professional.rating.crisisResponse / 5) * 10;
    score += ratingScore;
    reasoning.push(`Crisis response rating: ${professional.rating.crisisResponse}/5`);

    // Workload capacity (10% weight)
    const capacityRatio = professional.workload.currentCases / professional.workload.maxCases;
    const capacityScore = (1 - capacityRatio) * 10;
    score += capacityScore;
    reasoning.push(`Workload capacity: ${Math.round((1 - capacityRatio) * 100)}% available`);

    // Availability bonus (5% weight)
    const availability = this.availabilityCache.get(professional.id);
    if (availability?.emergencyContact) {
      score += 5;
      reasoning.push('Emergency contact available');
      estimatedResponseTime = Math.min(estimatedResponseTime, 2); // Emergency contacts respond faster
    }

    // Severity-based adjustments
    if (criteria.severity === 'critical') {
      // Prioritize highly rated professionals for critical cases
      score += professional.rating.overall;
      estimatedResponseTime = Math.min(estimatedResponseTime, 3);
    }

    // Check immediate availability
    const isImmediatelyAvailable = this.isImmediatelyAvailable(professional);
    const nextAvailable = isImmediatelyAvailable ? new Date() : this.getNextAvailableTime(professional);

    if (!isImmediatelyAvailable) {
      estimatedResponseTime += Math.max(0, (nextAvailable.getTime() - Date.now()) / (1000 * 60));
    }

    return {
      professional,
      score: Math.min(score, 100), // Cap at 100
      estimatedResponseTime: Math.ceil(estimatedResponseTime),
      reasoning,
      availability: {
        immediately: isImmediatelyAvailable,
        nextAvailable
      }
    };
  }

  private isImmediatelyAvailable(professional: Professional): boolean {
    const availability = this.availabilityCache.get(professional.id);
    return availability?.currentStatus === 'available' &&
           professional.workload.currentCases < professional.workload.maxCases;
  }

  private getNextAvailableTime(professional: Professional): Date {
    // Simplified - in production would check schedule and calculate next available slot
    const now = new Date();
    return new Date(now.getTime() + (30 * 60 * 1000)); // Assume 30 minutes from now
  }

  async updateProfessionalAvailability(
    professionalId: string,
    availability: Partial<ProfessionalAvailability>
  ): Promise<boolean> {
    try {
      const professional = this.professionals.get(professionalId);
      if (!professional) return false;

      const currentAvailability = this.availabilityCache.get(professionalId);
      if (!currentAvailability) return false;

      const updatedAvailability = { ...currentAvailability, ...availability, lastUpdated: new Date() };
      this.availabilityCache.set(professionalId, updatedAvailability);

      professional.availability = updatedAvailability;
      professional.updatedAt = new Date();

      logger.info({
        professionalId,
        status: updatedAvailability.currentStatus
      }, 'Professional availability updated');

      return true;

    } catch (error) {
      logger.error({
        professionalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Professional availability update failed');

      return false;
    }
  }

  async updateProfessionalWorkload(
    professionalId: string,
    caseChange: number // Positive to add case, negative to remove
  ): Promise<boolean> {
    try {
      const professional = this.professionals.get(professionalId);
      if (!professional) return false;

      professional.workload.currentCases = Math.max(0,
        professional.workload.currentCases + caseChange
      );
      professional.updatedAt = new Date();

      logger.info({
        professionalId,
        currentCases: professional.workload.currentCases,
        caseChange
      }, 'Professional workload updated');

      return true;

    } catch (error) {
      logger.error({
        professionalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Professional workload update failed');

      return false;
    }
  }

  getProfessionalById(id: string): Professional | null {
    return this.professionals.get(id) || null;
  }

  getAllProfessionals(): Professional[] {
    return Array.from(this.professionals.values());
  }

  getAvailableProfessionalsCount(): number {
    return this.getAvailableProfessionals().length;
  }

  // Method to add new professional (for admin onboarding)
  async addProfessional(professional: Omit<Professional, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `prof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newProfessional: Professional = {
      ...professional,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.professionals.set(id, newProfessional);
    this.availabilityCache.set(id, newProfessional.availability);

    logger.info({
      professionalId: id,
      name: newProfessional.name
    }, 'New professional added to network');

    return id;
  }
}