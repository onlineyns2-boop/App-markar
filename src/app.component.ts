import { Component, ChangeDetectionStrategy, signal, computed, effect, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly sanitizer = inject(DomSanitizer);

  // App state signals
  currentStep = signal(1);
  appName = signal('My App');
  appLogo = signal<string | null>(null);
  sourceType = signal<'url' | 'html' | 'multipage'>('url');
  appUrl = signal('');
  htmlContent = signal('');
  multiPageFiles = signal<File[]>([]);
  
  enableAds = signal(false);
  adScript = signal('');

  // Preview content signal
  previewContent = signal<string | null>(null);

  isStep1Valid = computed(() => this.appName().trim().length > 0);
  isStep2Valid = computed(() => {
    switch (this.sourceType()) {
      case 'url':
        try {
          new URL(this.appUrl());
          return this.appUrl().trim().length > 0;
        } catch {
          return false;
        }
      case 'html':
        return this.htmlContent().trim().length > 0;
      case 'multipage':
        return this.multiPageFiles().length > 0;
      default:
        return false;
    }
  });

  multiPageFileNames = computed(() => {
    const files = this.multiPageFiles();
    if (files.length === 0) return 'No files selected';
    if (files.length === 1) return files[0].name;
    return `${files.length} files selected`;
  });

  constructor() {
    effect(() => {
      if (this.sourceType() === 'url' && this.isStep2Valid()) {
        this.previewContent(this.appUrl());
      } else if (this.sourceType() === 'html') {
         const sanitizedHtml = this.sanitizer.sanitize(SecurityContext.HTML, this.htmlContent());
         this.previewContent(sanitizedHtml);
      } else {
        this.previewContent(null);
      }
    });
  }

  // Navigation
  nextStep(): void {
    if (this.currentStep() < 3) {
      this.currentStep.update(val => val + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(val => val - 1);
    }
  }

  // Input handlers
  handleAppNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.appName.set(input.value);
  }

  handleLogoUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.appLogo.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }
  
  selectSourceType(type: 'url' | 'html' | 'multipage'): void {
    this.sourceType.set(type);
  }

  handleUrlInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.appUrl.set(input.value);
  }
  
  handleHtmlInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.htmlContent.set(textarea.value);
  }

  handleMultiPageFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.multiPageFiles.set(Array.from(input.files));
    }
  }

  toggleEnableAds(): void {
    this.enableAds.update(enabled => !enabled);
  }

  handleAdScriptInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.adScript.set(textarea.value);
  }

  async downloadApp(): Promise<void> {
    let finalHtml = '';
    const sourceType = this.sourceType();

    if (sourceType === 'url') {
        finalHtml = this.generateUrlRedirectHtml(this.appUrl());
    } else if (sourceType === 'html') {
        finalHtml = this.htmlContent();
    } else if (sourceType === 'multipage') {
        const indexFile = this.multiPageFiles().find(f => f.name.toLowerCase() === 'index.html');
        if (indexFile) {
            finalHtml = await indexFile.text();
        } else {
            alert('Error: "index.html" not found in the selected files. Please include an index.html file.');
            return;
        }
    }

    if (this.enableAds() && this.adScript().trim()) {
        const script = this.adScript().trim();
        if (finalHtml.includes('</head>')) {
            finalHtml = finalHtml.replace('</head>', `\n${script}\n</head>`);
        } else {
            // Fallback for documents without a <head>
            finalHtml = `<html><head><title>${this.appName()}</title>${script}</head><body>${finalHtml}</body></html>`;
        }
    }

    const blob = new Blob([finalHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.appName().replace(/\s+/g, '-') || 'my-app'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private generateUrlRedirectHtml(url: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.appName()}</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe src="${url}"></iframe>
</body>
</html>`;
  }
}
