import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface CrisisResource {
  id: string;
  name: string;
  type: 'hotline' | 'chat' | 'text' | 'website' | 'app';
  description: string;
  contact: {
    primary: string;
    secondary?: string;
    website?: string;
  };
  availability: '24/7' | 'business_hours' | 'limited';
  languages: string[];
  specialty: string[];
  crisisTypes: string[];
  waitTime?: string;
  confidential: boolean;
  free: boolean;
  verified: boolean;
}

const CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: 'national-suicide-prevention-lifeline',
    name: 'National Suicide Prevention Lifeline',
    type: 'hotline',
    description: 'Free and confidential emotional support 24/7 for people in distress, prevention and crisis resources.',
    contact: {
      primary: '988',
      secondary: '1-800-273-8255',
      website: 'https://988lifeline.org'
    },
    availability: '24/7',
    languages: ['English', 'Spanish'],
    specialty: ['suicide_prevention', 'crisis_intervention', 'mental_health'],
    crisisTypes: ['suicidal_thoughts', 'mental_health_crisis', 'emotional_distress'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'crisis-text-line',
    name: 'Crisis Text Line',
    type: 'text',
    description: 'Free, 24/7 support for anyone in crisis. Text HOME to 741741 to connect with a Crisis Counselor.',
    contact: {
      primary: 'Text HOME to 741741',
      website: 'https://www.crisistextline.org'
    },
    availability: '24/7',
    languages: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'],
    specialty: ['crisis_intervention', 'mental_health', 'emotional_support'],
    crisisTypes: ['suicidal_thoughts', 'anxiety', 'depression', 'relationship_issues', 'self_harm'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'trans-lifeline',
    name: 'Trans Lifeline',
    type: 'hotline',
    description: 'A hotline staffed by transgender people, for transgender people. Support for the trans community.',
    contact: {
      primary: '877-565-8860',
      website: 'https://translifeline.org'
    },
    availability: '24/7',
    languages: ['English', 'Spanish'],
    specialty: ['transgender_support', 'LGBTQ_crisis', 'gender_identity'],
    crisisTypes: ['gender_identity_crisis', 'transphobia', 'coming_out_support'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'veterans-crisis-line',
    name: 'Veterans Crisis Line',
    type: 'hotline',
    description: 'Free, confidential support for veterans and their families. Available 24/7.',
    contact: {
      primary: '988 then press 1',
      secondary: '1-800-273-8255 (press 1)',
      website: 'https://www.veteranscrisisline.net'
    },
    availability: '24/7',
    languages: ['English', 'Spanish'],
    specialty: ['veterans_support', 'military_mental_health', 'PTSD'],
    crisisTypes: ['PTSD', 'military_trauma', 'veteran_suicide_prevention'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'rainn-national-sexual-assault-hotline',
    name: 'RAINN National Sexual Assault Hotline',
    type: 'hotline',
    description: 'Confidential support for survivors of sexual assault, their friends and families.',
    contact: {
      primary: '1-800-656-4673',
      website: 'https://www.rainn.org'
    },
    availability: '24/7',
    languages: ['English', 'Spanish'],
    specialty: ['sexual_assault_support', 'trauma_recovery', 'domestic_violence'],
    crisisTypes: ['sexual_assault', 'rape', 'domestic_violence', 'stalking'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'eating-disorders-helpline',
    name: 'National Eating Disorders Association Helpline',
    type: 'chat',
    description: 'Free and confidential support for anyone struggling with an eating disorder.',
    contact: {
      primary: '1-800-931-2237',
      website: 'https://www.nationaleatingdisorders.org/learn/general-information/helpline'
    },
    availability: 'business_hours',
    languages: ['English'],
    specialty: ['eating_disorders', 'body_image', 'food_addiction'],
    crisisTypes: ['eating_disorders', 'anorexia', 'bulimia', 'binge_eating'],
    waitTime: 'Usually immediate during business hours',
    confidential: true,
    free: true,
    verified: true
  },
  {
    id: 'substance-abuse-helpline',
    name: 'SAMHSA National Helpline',
    type: 'hotline',
    description: 'Free, confidential, 24/7 treatment referral and information service for individuals and families facing mental and/or substance use disorders.',
    contact: {
      primary: '1-800-662-HELP (4357)',
      website: 'https://www.samhsa.gov/find-help/national-helpline'
    },
    availability: '24/7',
    languages: ['English', 'Spanish'],
    specialty: ['substance_abuse', 'addiction', 'mental_health_dual_diagnosis'],
    crisisTypes: ['substance_abuse', 'addiction', 'overdose', 'dual_diagnosis'],
    waitTime: 'Usually immediate',
    confidential: true,
    free: true,
    verified: true
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const crisisType = searchParams.get('crisisType');
    const specialty = searchParams.get('specialty');
    const language = searchParams.get('language');
    const availability = searchParams.get('availability');

    let filteredResources = [...CRISIS_RESOURCES];

    // Filter by crisis type
    if (crisisType) {
      filteredResources = filteredResources.filter(resource =>
        resource.crisisTypes.includes(crisisType)
      );
    }

    // Filter by specialty
    if (specialty) {
      filteredResources = filteredResources.filter(resource =>
        resource.specialty.includes(specialty)
      );
    }

    // Filter by language
    if (language) {
      filteredResources = filteredResources.filter(resource =>
        resource.languages.includes(language)
      );
    }

    // Filter by availability
    if (availability) {
      filteredResources = filteredResources.filter(resource =>
        resource.availability === availability
      );
    }

    // Sort by priority (24/7 first, then verified status)
    filteredResources.sort((a, b) => {
      if (a.availability === '24/7' && b.availability !== '24/7') return -1;
      if (b.availability === '24/7' && a.availability !== '24/7') return 1;
      if (a.verified && !b.verified) return -1;
      if (b.verified && !a.verified) return 1;
      return 0;
    });

    logger.info({
      totalResources: CRISIS_RESOURCES.length,
      filteredCount: filteredResources.length,
      filters: { crisisType, specialty, language, availability }
    }, 'Crisis resources requested');

    return NextResponse.json({
      success: true,
      resources: filteredResources,
      totalCount: filteredResources.length,
      filters: {
        crisisType: crisisType || null,
        specialty: specialty || null,
        language: language || null,
        availability: availability || null
      },
      disclaimer: 'These resources are provided for informational purposes. In case of immediate danger, please call emergency services (911 in the US).'
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Crisis resources API error');

    return NextResponse.json({
      error: 'Failed to retrieve crisis resources',
      resources: [],
      disclaimer: 'Please call emergency services (911) if you are in immediate danger.'
    }, { status: 500 });
  }
}

// POST endpoint for emergency override (admin only)
export async function POST(request: NextRequest) {
  try {
    // This would be used by admins to add emergency resources during crises
    // Implementation would require admin authentication and validation

    const body = await request.json();
    const { resource, priority } = body;

    // Placeholder for emergency resource addition
    logger.warn({
      resource: resource?.name,
      priority
    }, 'Emergency resource addition requested');

    return NextResponse.json({
      success: false,
      message: 'Emergency resource addition not implemented yet',
      status: 'not_implemented'
    }, { status: 501 });

  } catch (error) {
    return NextResponse.json({
      error: 'Emergency resource addition failed'
    }, { status: 500 });
  }
}