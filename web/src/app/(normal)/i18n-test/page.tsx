'use client';

import React from 'react';
import { useT } from '@/i18n/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Layers, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function I18nTestPage() {
  // 1. Root level t (Global)
  const tGlobal = useT();
  
  // 2. Scoped level 1
  const tLevel1 = useT('test.level1');
  
  // 3. Scoped level 2
  const tLevel2 = useT('test.level1.level2');
  
  // 4. Scoped level 4 (Deeply nested)
  const tLevel4 = useT('test.level1.level2.level3.level4');

  return (
    <div className="container max-w-4xl py-10 space-y-10 animate-in fade-in duration-200">
      <div className="space-y-2">
        <h1 className="figma-display-lg text-text-main">
          {tGlobal('test.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          Testing multi-layer scoped translation type safety and runtime resolution.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Level 1 Scope */}
        <Card className="overflow-hidden border-border-main bg-bg-canvas transition-colors duration-200 hover:border-border-strong">
          <CardHeader className="border-b border-border-main bg-bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary p-2 text-primary-foreground">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-xl">Scope: <code className="text-brand">test.level1</code></CardTitle>
              </div>
              <Badge variant="outline" className="border-border-main bg-bg-canvas">Level 1</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-border-main bg-bg-surface p-3 transition-colors">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium uppercase tracking-[0.03125rem] text-muted-foreground">{"t('title')"}</p>
                <p className="text-xl font-medium">{tLevel1('title')}</p>
              </div>
            </div>
            <div className="rounded-md border border-border-main bg-bg-surface p-3">
               <code className="text-xs text-muted-foreground">{"useT('test.level1') -> t('title')"}</code>
            </div>
          </CardContent>
        </Card>

        {/* Level 2 Scope */}
        <Card className="overflow-hidden border-border-main bg-bg-surface transition-colors duration-200 hover:border-border-strong">
          <CardHeader className="border-b border-border-main bg-bg-canvas">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary p-2 text-primary-foreground">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-xl">Scope: <code className="font-medium text-text-main">test...level2</code></CardTitle>
              </div>
              <Badge variant="outline" className="border-border-main bg-bg-canvas">Level 2</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-border-main bg-bg-canvas p-4 transition-colors">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.03125rem] text-muted-foreground">{"t('title')"}</p>
                <p className="text-lg font-medium">{tLevel2('title')}</p>
              </div>
              <div className="rounded-md border border-border-main bg-bg-canvas p-4 transition-colors">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.03125rem] text-muted-foreground">{"t('message')"}</p>
                <p className="text-lg font-medium">{tLevel2('message')}</p>
              </div>
            </div>
             <div className="rounded-md border border-border-main bg-bg-canvas p-3 text-center">
               <code className="text-xs text-muted-foreground">{"t.test('level1.level2.message') -> "}{tGlobal.test('level1.level2.message')}</code>
            </div>
          </CardContent>
        </Card>

        {/* Level 4 Scope - Deepest */}
        <Card className="group relative overflow-hidden border-border-main bg-bg-surface transition-colors duration-200 hover:border-border-strong">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers className="w-40 h-40 -mr-10 -mt-10 rotate-12" />
          </div>
          <CardHeader className="border-b border-border-main bg-bg-canvas">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary p-2 text-primary-foreground">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-xl">Scope: <code className="font-mono text-text-main">level4</code></CardTitle>
              </div>
              <Badge variant="outline" className="border-border-main bg-bg-canvas">Level 4 Deep</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="rounded-lg border border-dashed border-border-main bg-bg-canvas p-6 transition-colors group-hover:border-border-strong">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-medium text-text-main">
                  <span>{tLevel4('title')}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
                <h3 className="text-2xl font-medium tracking-normal">{tLevel4('message')}</h3>
                <p className="rounded-md border border-border-main bg-bg-surface p-3 font-mono text-sm text-muted-foreground">
                  {tLevel4('deepValue', { value: 'Successfully Injected!' })}
                </p>
              </div>
            </div>
            
            <Separator className="bg-border-main" />
            
            <div className="flex items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
              <span className="rounded-md border border-border-main bg-bg-canvas px-2 py-1">TypeScript Verified</span>
              <span className="rounded-md border border-border-main bg-bg-canvas px-2 py-1">Runtime Resolved</span>
              <span className="rounded-md border border-border-main bg-bg-canvas px-2 py-1">Dynamic Loaded</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
