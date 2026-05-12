export interface MarketingNavItem {
  label: string;
  href?: string;
  placeholder?: boolean;
}

export interface MarketingHeroMockupContent {
  sidebarTitle: string;
  projectsLabel: string;
  flowsLabel: string;
  environmentsLabel: string;
  teamspacesLabel: string;
  activeProject: string;
  flowOne: string;
  flowTwo: string;
  environmentValue: string;
  teamValue: string;
  workspaceTitle: string;
  workspaceSubtitle: string;
  requestOne: string;
  requestTwo: string;
  requestThree: string;
  tokenForwarded: string;
  sessionForwarded: string;
  variableForwarded: string;
  headersForwarded: string;
  resultsTitle: string;
  statusLabel: string;
  failedCheck: string;
  failedHint: string;
  aiTitle: string;
  aiReason: string;
  aiAction: string;
  historyTitle: string;
  historyOne: string;
  historyTwo: string;
  historyThree: string;
}

export interface MarketingHeroContent {
  badge: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  supportingNote: string;
  mockup: MarketingHeroMockupContent;
}

export interface MarketingLogoItem {
  name: string;
  tone?: 'ink' | 'blue' | 'teal' | 'coral' | 'yellow';
}

export type MarketingFeatureIconKey =
  | 'flows'
  | 'context'
  | 'history'
  | 'collaboration'
  | 'workflow'
  | 'diagnosis';

export interface MarketingFeatureItem {
  icon: MarketingFeatureIconKey;
  title: string;
  description: string;
}

export interface MarketingFeatureSectionContent {
  eyebrow: string;
  title: string;
  description: string;
  items: MarketingFeatureItem[];
}

export type MarketingStoryVariant = 'flow' | 'history' | 'ai';
export type MarketingBlockTone = 'lime' | 'lilac' | 'cream' | 'mint' | 'pink' | 'coral' | 'navy';

export interface MarketingStoryMockupContent {
  title: string;
  lines: string[];
}

export interface MarketingStorySectionContent {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  ctaHref: string;
  variant: MarketingStoryVariant;
  blockTone: MarketingBlockTone;
  mockup: MarketingStoryMockupContent;
}

export interface MarketingStatItem {
  value: string;
  label: string;
  detail: string;
}

export interface MarketingStatsContent {
  eyebrow: string;
  title: string;
  description: string;
  items: MarketingStatItem[];
}

export interface MarketingPricingTier {
  name: string;
  description: string;
  price: string;
  cadence: string;
  badge?: string;
  cta: string;
  features: string[];
  featured?: boolean;
  enterprise?: boolean;
}

export interface MarketingPricingFeatureRow {
  section?: string;
  feature: string;
  free: string;
  starter: string;
  business: string;
  enterprise: string;
}

export interface MarketingPricingContent {
  eyebrow: string;
  title: string;
  description: string;
  monthlyLabel: string;
  annualLabel: string;
  discountLabel: string;
  tiers: MarketingPricingTier[];
  comparisonTitle: string;
  comparisonRows: MarketingPricingFeatureRow[];
}

export interface MarketingFinalCtaContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  pricingHint: string;
}

export interface MarketingFooterLink {
  label: string;
  href?: string;
  placeholder?: boolean;
}

export interface MarketingFooterColumn {
  title: string;
  links: MarketingFooterLink[];
}

export interface MarketingFooterContent {
  tagline: string;
  columns: MarketingFooterColumn[];
  socialsTitle: string;
  socials: MarketingFooterLink[];
  appStoreLabel: string;
  googlePlayLabel: string;
  reviewBadgeLabel: string;
}

export interface MarketingChromeContent {
  brandName: string;
  navItems: MarketingNavItem[];
  loginLabel: string;
  signUpLabel: string;
  contactSalesLabel: string;
  docsSoonLabel: string;
  footer: MarketingFooterContent;
}

export interface MarketingPageContent {
  hero: MarketingHeroContent;
  logosTitle: string;
  logos: MarketingLogoItem[];
  features: MarketingFeatureSectionContent;
  sections: MarketingStorySectionContent[];
  pricing: MarketingPricingContent;
  stats: MarketingStatsContent;
  finalCta: MarketingFinalCtaContent;
}
