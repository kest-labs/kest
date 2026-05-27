import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketingHomePage } from '@/components/features/site/home';
import type { MarketingPageContent } from '@/components/features/site/home';

const mockContent: MarketingPageContent = {
  hero: {
    badge: 'OPEN SOURCE API TESTING',
    title: 'Test APIs with context, history, and AI-powered diagnosis',
    description: 'Hero description',
    primaryCta: 'Get Started',
    secondaryCta: 'View API Docs',
    supportingNote: 'Open-source core note',
    mockup: {
      sidebarTitle: 'Workspace',
      workspacesLabel: 'Workspaces',
      flowsLabel: 'Flows',
      environmentsLabel: 'Environments',
      teamspacesLabel: 'Team spaces',
      activeWorkspace: 'Payments Platform',
      flowOne: 'Auth chain',
      flowTwo: 'Checkout regression',
      environmentValue: 'Staging EU',
      teamValue: 'Core API',
      workspaceTitle: 'Context-aware test flow',
      workspaceSubtitle: 'Treat requests as one flow.',
      requestOne: 'POST /auth/login',
      requestTwo: 'GET /me',
      requestThree: 'POST /billing/preview',
      tokenForwarded: 'Token forwarded',
      sessionForwarded: 'Session forwarded',
      variableForwarded: 'Variable forwarded',
      headersForwarded: 'Headers forwarded',
      resultsTitle: 'Execution result',
      statusLabel: 'Status',
      failedCheck: 'Failed check',
      failedHint: 'Failure hint',
      aiTitle: 'AI diagnosis',
      aiReason: 'AI reason',
      aiAction: 'AI action',
      historyTitle: 'Recent runs',
      historyOne: '2 min ago',
      historyTwo: '18 min ago',
      historyThree: '1 hour ago',
    },
  },
  logosTitle: 'Built for modern API teams',
  logos: [{ name: 'NORTHSTACK' }, { name: 'VECTORLAB' }],
  features: {
    eyebrow: 'Core capabilities',
    title: 'Feature title',
    description: 'Feature description',
    items: [
      { icon: 'flows', title: 'Visual Test Flows', description: 'desc' },
      { icon: 'context', title: 'Context-Aware Requests', description: 'desc' },
      { icon: 'history', title: 'Historical Results', description: 'desc' },
      { icon: 'collaboration', title: 'Team Collaboration', description: 'desc' },
      { icon: 'workflow', title: '.flow.md Workflow Files', description: 'desc' },
      { icon: 'diagnosis', title: 'AI Failure Diagnosis', description: 'desc' },
    ],
  },
  sections: [
    {
      id: 'product',
      eyebrow: 'Visualize the chain',
      title: 'See every test as a connected flow',
      description: 'Section one',
      points: ['A', 'B', 'C', 'D'],
      cta: 'Explore visual flows',
      ctaHref: '#features',
      variant: 'flow',
      blockTone: 'lime',
      mockup: { title: 'Flow canvas', lines: ['1', '2', '3', '4', '5', '6', '7', '8'] },
    },
    {
      id: 'resources',
      eyebrow: 'History and collaboration',
      title: 'Track results over time and keep teams aligned',
      description: 'Section two',
      points: ['A', 'B', 'C', 'D'],
      cta: 'Open shared workspaces',
      ctaHref: '/register',
      variant: 'history',
      blockTone: 'navy',
      mockup: { title: 'Team timeline', lines: ['1', '2', '3', '4'] },
    },
    {
      id: 'workflow-files',
      eyebrow: 'AI + .flow.md',
      title: 'Readable workflows for humans, diagnosable by AI',
      description: 'Section three',
      points: ['A', 'B', 'C', 'D'],
      cta: 'Review workflow examples',
      ctaHref: '/register',
      variant: 'ai',
      blockTone: 'coral',
      mockup: { title: '.flow.md snapshot', lines: ['1', '2', '3', '4'] },
    },
  ],
  stats: {
    eyebrow: 'Why teams switch',
    title: 'Designed for execution-heavy API teams',
    description: 'Stats description',
    items: [
      { value: '10K+', label: 'test runs visualized', detail: 'detail' },
      { value: '500+', label: 'teams collaborating', detail: 'detail' },
      { value: '90%', label: 'faster debugging', detail: 'detail' },
      { value: '100%', label: 'readable workflow files', detail: 'detail' },
    ],
  },
  pricing: {
    eyebrow: 'Plans and pricing',
    title: 'Start open, then scale governance',
    description: 'Pricing description',
    monthlyLabel: 'Monthly',
    annualLabel: 'Annual',
    discountLabel: 'Save 15%',
    tiers: [
      {
        name: 'Free',
        description: 'Free description',
        price: '$0',
        cadence: 'per user / month',
        cta: 'Start free',
        features: ['Local workspaces', 'Basic flows', 'Seven-day history'],
      },
      {
        name: 'Starter',
        description: 'Starter description',
        price: '$8',
        cadence: 'per user / month',
        cta: 'Choose Starter',
        features: ['Shared workspaces', 'Variables', 'Thirty-day history'],
      },
      {
        name: 'Business',
        description: 'Business description',
        price: '$16',
        cadence: 'per user / month',
        badge: 'Popular',
        cta: 'Choose Business',
        featured: true,
        features: ['AI diagnosis', 'Roles', 'Unlimited history'],
      },
      {
        name: 'Enterprise',
        description: 'Enterprise description',
        price: 'Custom',
        cadence: 'annual contract',
        cta: 'Contact sales',
        enterprise: true,
        features: ['SSO', 'Audit', 'Governance'],
      },
    ],
    comparisonTitle: 'Compare the essentials',
    comparisonRows: [
      {
        feature: 'Visual test flows',
        free: 'Basic',
        starter: 'Standard',
        business: 'Advanced',
        enterprise: 'Custom',
      },
    ],
  },
  finalCta: {
    eyebrow: 'Start building',
    title: 'Build smarter API test workflows with your team',
    description: 'Final CTA description',
    primaryCta: 'Start Free',
    secondaryCta: 'Read API Docs',
    pricingHint: 'Pricing hint',
  },
};

describe('MarketingHomePage', () => {
  it('renders the major homepage sections and CTA labels', () => {
    render(<MarketingHomePage content={mockContent} />);

    expect(
      screen.getByRole('heading', {
        name: 'Test APIs with context, history, and AI-powered diagnosis',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Built for modern API teams')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Feature title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start open, then scale governance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Business' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Designed for execution-heavy API teams' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Build smarter API test workflows with your team' })).toBeInTheDocument();
    expect(screen.getAllByText('View API Docs').length).toBeGreaterThan(0);
    expect(screen.getByText('Start Free')).toBeInTheDocument();
  });
});
