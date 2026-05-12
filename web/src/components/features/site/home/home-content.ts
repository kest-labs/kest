import type { ScopedTranslations } from '@/i18n/shared';
import type {
  MarketingChromeContent,
  MarketingFeatureSectionContent,
  MarketingLogoItem,
  MarketingPageContent,
  MarketingStorySectionContent,
} from './types';

type MarketingTranslator = ScopedTranslations<'marketing'>;

// 统一维护对外文档站地址，避免导航和 footer 分别写死多个链接。
const API_DOCS_URL = 'https://kest-docs.vercel.app';

const logoNames: MarketingLogoItem[] = [
  { name: 'NORTHSTACK', tone: 'ink' },
  { name: 'VECTORLAB', tone: 'blue' },
  { name: 'AURORA API', tone: 'teal' },
  { name: 'SHIPYARD', tone: 'coral' },
  { name: 'LATTICE', tone: 'yellow' },
  { name: 'STACKPORT', tone: 'ink' },
  { name: 'TRACEGRID', tone: 'blue' },
  { name: 'MERIDIAN', tone: 'teal' },
  { name: 'UNIT 47', tone: 'coral' },
  { name: 'ORBITAL', tone: 'yellow' },
];

// 组装营销站顶部导航和 footer 文案。
// 作用：把 API Docs 统一指向外部文档站，页面层只消费结构化内容。
export function buildMarketingChromeContent(t: MarketingTranslator): MarketingChromeContent {
  return {
    brandName: t('brand.name'),
    navItems: [
      { label: t('nav.product'), href: '#product' },
      { label: t('nav.features'), href: '#features' },
      { label: t('nav.apiDocs'), href: API_DOCS_URL },
      { label: t('nav.resources'), href: '#resources' },
      { label: t('nav.pricing'), href: '#pricing' },
    ],
    loginLabel: t('nav.login'),
    signUpLabel: t('nav.signUp'),
    contactSalesLabel: t('nav.contactSales'),
    docsSoonLabel: t('nav.docsSoon'),
    footer: {
      tagline: t('brand.tagline'),
      socialsTitle: t('footer.socialTitle'),
      columns: [
        {
          title: t('footer.product'),
          links: [
            { label: t('footer.links.overview'), href: '#product' },
            { label: t('footer.links.features'), href: '#features' },
            { label: t('footer.links.flows'), href: '#resources' },
          ],
        },
        {
          title: t('footer.solutions'),
          links: [
            { label: t('footer.links.teams'), href: '#features' },
            { label: t('footer.links.enterprise'), href: '#pricing' },
            { label: t('footer.links.security'), placeholder: true },
          ],
        },
        {
          title: t('footer.tools'),
          links: [
            { label: t('footer.links.docsOverview'), href: API_DOCS_URL },
            { label: t('footer.links.examples'), href: API_DOCS_URL },
            { label: t('footer.links.schemas'), href: API_DOCS_URL },
          ],
        },
        {
          title: t('footer.resources'),
          links: [
            { label: t('footer.links.guides'), href: '#resources' },
            { label: t('footer.links.changelog'), placeholder: true },
            { label: t('footer.links.blog'), placeholder: true },
          ],
        },
        {
          title: t('footer.company'),
          links: [
            { label: t('footer.links.openSource'), href: '#pricing' },
            { label: t('footer.links.careers'), placeholder: true },
            { label: t('footer.links.contact'), placeholder: true },
          ],
        },
        {
          title: t('footer.plans'),
          links: [
            { label: t('footer.links.pricing'), href: '#pricing' },
            { label: t('footer.links.contactSales'), placeholder: true },
            { label: t('footer.links.privacy'), placeholder: true },
          ],
        },
      ],
      socials: [
        { label: t('footer.links.github'), placeholder: true },
        { label: t('footer.links.discord'), placeholder: true },
        { label: t('footer.links.x'), placeholder: true },
      ],
      appStoreLabel: t('footer.appStore'),
      googlePlayLabel: t('footer.googlePlay'),
      reviewBadgeLabel: t('footer.reviewBadge'),
    },
  };
}

function buildFeatureSection(t: MarketingTranslator): MarketingFeatureSectionContent {
  return {
    eyebrow: t('features.eyebrow'),
    title: t('features.title'),
    description: t('features.description'),
    items: [
      {
        icon: 'flows',
        title: t('features.items.flows.title'),
        description: t('features.items.flows.description'),
      },
      {
        icon: 'context',
        title: t('features.items.context.title'),
        description: t('features.items.context.description'),
      },
      {
        icon: 'history',
        title: t('features.items.history.title'),
        description: t('features.items.history.description'),
      },
      {
        icon: 'collaboration',
        title: t('features.items.collaboration.title'),
        description: t('features.items.collaboration.description'),
      },
      {
        icon: 'workflow',
        title: t('features.items.workflow.title'),
        description: t('features.items.workflow.description'),
      },
      {
        icon: 'diagnosis',
        title: t('features.items.diagnosis.title'),
        description: t('features.items.diagnosis.description'),
      },
    ],
  };
}

function buildStorySections(t: MarketingTranslator): MarketingStorySectionContent[] {
  return [
    {
      id: 'product',
      eyebrow: t('sections.flow.eyebrow'),
      title: t('sections.flow.title'),
      description: t('sections.flow.description'),
      points: [
        t('sections.flow.points.one'),
        t('sections.flow.points.two'),
        t('sections.flow.points.three'),
        t('sections.flow.points.four'),
      ],
      cta: t('sections.flow.cta'),
      ctaHref: '#features',
      variant: 'flow',
      blockTone: 'lime',
      mockup: {
        title: t('sections.flow.mockup.title'),
        lines: [
          t('sections.flow.mockup.laneOne'),
          t('sections.flow.mockup.detailOne'),
          t('sections.flow.mockup.laneTwo'),
          t('sections.flow.mockup.detailTwo'),
          t('sections.flow.mockup.laneThree'),
          t('sections.flow.mockup.detailThree'),
          t('sections.flow.mockup.laneFour'),
          t('sections.flow.mockup.detailFour'),
        ],
      },
    },
    {
      id: 'resources',
      eyebrow: t('sections.history.eyebrow'),
      title: t('sections.history.title'),
      description: t('sections.history.description'),
      points: [
        t('sections.history.points.one'),
        t('sections.history.points.two'),
        t('sections.history.points.three'),
        t('sections.history.points.four'),
      ],
      cta: t('sections.history.cta'),
      ctaHref: '/register',
      variant: 'history',
      blockTone: 'navy',
      mockup: {
        title: t('sections.history.mockup.title'),
        lines: [
          t('sections.history.mockup.feedOne'),
          t('sections.history.mockup.feedTwo'),
          t('sections.history.mockup.feedThree'),
          t('sections.history.mockup.feedFour'),
        ],
      },
    },
    {
      id: 'workflow-files',
      eyebrow: t('sections.ai.eyebrow'),
      title: t('sections.ai.title'),
      description: t('sections.ai.description'),
      points: [
        t('sections.ai.points.one'),
        t('sections.ai.points.two'),
        t('sections.ai.points.three'),
        t('sections.ai.points.four'),
      ],
      cta: t('sections.ai.cta'),
      ctaHref: '/register',
      variant: 'ai',
      blockTone: 'coral',
      mockup: {
        title: t('sections.ai.mockup.title'),
        lines: [
          t('sections.ai.mockup.lineOne'),
          t('sections.ai.mockup.lineTwo'),
          t('sections.ai.mockup.lineThree'),
          t('sections.ai.mockup.lineFour'),
        ],
      },
    },
  ];
}

function buildComparisonRows(t: MarketingTranslator) {
  const sections = [
    {
      section: t('pricing.comparison.flows'),
      rows: [
        ['Flow canvas', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Request dependencies', t('pricing.values.limited'), t('pricing.values.included'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Step health signals', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Variable capture', t('pricing.values.limited'), t('pricing.values.included'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Shared flow templates', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Branch comparison', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Reusable environments', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Collection nesting', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Flow comments', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Run queue', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Scheduled checks', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Reusable assertions', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Team libraries', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Flow import', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Flow export', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Visual diff', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Workspace graph', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Context replay', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Shared scratchpads', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Flow approvals', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
      ],
    },
    {
      section: t('pricing.comparison.history'),
      rows: [
        ['Run history retention', t('pricing.values.sevenDays'), t('pricing.values.thirtyDays'), t('pricing.values.unlimited'), t('pricing.values.unlimited')],
        ['Failure timeline', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Response snapshots', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Latency trends', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Change markers', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Environment timeline', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Request replay', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Regression baselines', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Artifact retention', t('pricing.values.limited'), t('pricing.values.thirtyDays'), t('pricing.values.unlimited'), t('pricing.values.custom')],
        ['Team activity feed', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Run annotations', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Exportable reports', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Webhook events', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Incident links', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Historical search', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Status archive', t('pricing.values.sevenDays'), t('pricing.values.thirtyDays'), t('pricing.values.unlimited'), t('pricing.values.unlimited')],
        ['Run ownership', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Saved filters', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Timeline sharing', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Audit timeline', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
      ],
    },
    {
      section: t('pricing.comparison.ai'),
      rows: [
        ['AI failure summary', t('pricing.values.limited'), t('pricing.values.included'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Root-cause hints', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Context-aware prompts', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Last-green comparison', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Suggested remaps', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Schema explanation', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Run summarization', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Workflow generation', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Prompt controls', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Sensitive-field masking', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Custom diagnosis rules', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['AI handoff notes', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['Spec drafting', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Error clustering', t('pricing.values.limited'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Team prompt library', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['AI usage controls', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Model routing', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Private context windows', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Diagnostic exports', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.included'), t('pricing.values.custom')],
        ['AI review queue', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
      ],
    },
    {
      section: t('pricing.comparison.governance'),
      rows: [
        ['Workspace roles', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Project permissions', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['SSO', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Audit logs', t('pricing.values.limited'), t('pricing.values.thirtyDays'), t('pricing.values.unlimited'), t('pricing.values.custom')],
        ['Data retention policy', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Environment secrets', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Deployment controls', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Domain controls', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['SCIM', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.custom')],
        ['Legal hold', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Priority support', t('pricing.values.basic'), t('pricing.values.standard'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Workspace templates', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Approval policies', t('pricing.values.limited'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Compliance exports', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Private deployment', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.custom')],
        ['Custom onboarding', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.priority'), t('pricing.values.custom')],
        ['Security review', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Admin analytics', t('pricing.values.basic'), t('pricing.values.team'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Dedicated workspace controls', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.advanced'), t('pricing.values.custom')],
        ['Enterprise success plan', t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.limited'), t('pricing.values.custom')],
      ],
    },
  ];

  return sections.flatMap(({ section, rows }) =>
    rows.map(([feature, free, starter, business, enterprise], index) => ({
      section: index === 0 ? section : undefined,
      feature,
      free,
      starter,
      business,
      enterprise,
    }))
  );
}

export function buildMarketingPageContent(t: MarketingTranslator): MarketingPageContent {
  return {
    hero: {
      badge: t('hero.badge'),
      title: t('hero.title'),
      description: t('hero.description'),
      primaryCta: t('hero.primaryCta'),
      secondaryCta: t('hero.secondaryCta'),
      supportingNote: t('hero.supportingNote'),
      mockup: {
        sidebarTitle: t('hero.mockup.sidebarTitle'),
        projectsLabel: t('hero.mockup.projectsLabel'),
        flowsLabel: t('hero.mockup.flowsLabel'),
        environmentsLabel: t('hero.mockup.environmentsLabel'),
        teamspacesLabel: t('hero.mockup.teamspacesLabel'),
        activeProject: t('hero.mockup.activeProject'),
        flowOne: t('hero.mockup.flowOne'),
        flowTwo: t('hero.mockup.flowTwo'),
        environmentValue: t('hero.mockup.environmentValue'),
        teamValue: t('hero.mockup.teamValue'),
        workspaceTitle: t('hero.mockup.workspaceTitle'),
        workspaceSubtitle: t('hero.mockup.workspaceSubtitle'),
        requestOne: t('hero.mockup.requestOne'),
        requestTwo: t('hero.mockup.requestTwo'),
        requestThree: t('hero.mockup.requestThree'),
        tokenForwarded: t('hero.mockup.tokenForwarded'),
        sessionForwarded: t('hero.mockup.sessionForwarded'),
        variableForwarded: t('hero.mockup.variableForwarded'),
        headersForwarded: t('hero.mockup.headersForwarded'),
        resultsTitle: t('hero.mockup.resultsTitle'),
        statusLabel: t('hero.mockup.statusLabel'),
        failedCheck: t('hero.mockup.failedCheck'),
        failedHint: t('hero.mockup.failedHint'),
        aiTitle: t('hero.mockup.aiTitle'),
        aiReason: t('hero.mockup.aiReason'),
        aiAction: t('hero.mockup.aiAction'),
        historyTitle: t('hero.mockup.historyTitle'),
        historyOne: t('hero.mockup.historyOne'),
        historyTwo: t('hero.mockup.historyTwo'),
        historyThree: t('hero.mockup.historyThree'),
      },
    },
    logosTitle: t('logos.title'),
    logos: logoNames.map((logo) => ({ name: logo.name, tone: logo.tone })),
    features: buildFeatureSection(t),
    sections: buildStorySections(t),
    pricing: {
      eyebrow: t('pricing.eyebrow'),
      title: t('pricing.title'),
      description: t('pricing.description'),
      monthlyLabel: t('pricing.monthly'),
      annualLabel: t('pricing.annual'),
      discountLabel: t('pricing.discount'),
      tiers: [
        {
          name: t('pricing.tiers.free.name'),
          description: t('pricing.tiers.free.description'),
          price: t('pricing.tiers.free.price'),
          cadence: t('pricing.tiers.free.cadence'),
          cta: t('pricing.tiers.free.cta'),
          features: [
            t('pricing.tiers.free.features.one'),
            t('pricing.tiers.free.features.two'),
            t('pricing.tiers.free.features.three'),
          ],
        },
        {
          name: t('pricing.tiers.starter.name'),
          description: t('pricing.tiers.starter.description'),
          price: t('pricing.tiers.starter.price'),
          cadence: t('pricing.tiers.starter.cadence'),
          cta: t('pricing.tiers.starter.cta'),
          features: [
            t('pricing.tiers.starter.features.one'),
            t('pricing.tiers.starter.features.two'),
            t('pricing.tiers.starter.features.three'),
          ],
        },
        {
          name: t('pricing.tiers.business.name'),
          description: t('pricing.tiers.business.description'),
          price: t('pricing.tiers.business.price'),
          cadence: t('pricing.tiers.business.cadence'),
          badge: t('pricing.tiers.business.badge'),
          cta: t('pricing.tiers.business.cta'),
          featured: true,
          features: [
            t('pricing.tiers.business.features.one'),
            t('pricing.tiers.business.features.two'),
            t('pricing.tiers.business.features.three'),
          ],
        },
        {
          name: t('pricing.tiers.enterprise.name'),
          description: t('pricing.tiers.enterprise.description'),
          price: t('pricing.tiers.enterprise.price'),
          cadence: t('pricing.tiers.enterprise.cadence'),
          cta: t('pricing.tiers.enterprise.cta'),
          enterprise: true,
          features: [
            t('pricing.tiers.enterprise.features.one'),
            t('pricing.tiers.enterprise.features.two'),
            t('pricing.tiers.enterprise.features.three'),
          ],
        },
      ],
      comparisonTitle: t('pricing.comparisonTitle'),
      comparisonRows: buildComparisonRows(t),
    },
    stats: {
      eyebrow: t('stats.eyebrow'),
      title: t('stats.title'),
      description: t('stats.description'),
      items: [
        {
          value: t('stats.items.runs.value'),
          label: t('stats.items.runs.label'),
          detail: t('stats.items.runs.detail'),
        },
        {
          value: t('stats.items.teams.value'),
          label: t('stats.items.teams.label'),
          detail: t('stats.items.teams.detail'),
        },
        {
          value: t('stats.items.debugging.value'),
          label: t('stats.items.debugging.label'),
          detail: t('stats.items.debugging.detail'),
        },
        {
          value: t('stats.items.readable.value'),
          label: t('stats.items.readable.label'),
          detail: t('stats.items.readable.detail'),
        },
      ],
    },
    finalCta: {
      eyebrow: t('cta.eyebrow'),
      title: t('cta.title'),
      description: t('cta.description'),
      primaryCta: t('cta.primaryCta'),
      secondaryCta: t('cta.secondaryCta'),
      pricingHint: t('cta.pricingHint'),
    },
  };
}
