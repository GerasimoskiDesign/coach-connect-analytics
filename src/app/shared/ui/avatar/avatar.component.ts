import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div class="avatar"
         [class.size-sm]="size === 'sm'"
         [class.size-md]="size === 'md'"
         [class.size-lg]="size === 'lg'"
         [class.variant-warm]="variant === 'warm'"
         [class.variant-dark]="variant === 'dark'"
         [class.variant-gold]="variant === 'gold'"
         [attr.aria-label]="initials">
      {{ displayInitials }}
    </div>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }

    .avatar {
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      color: rgba(255,255,255,0.95);
      letter-spacing: -0.02em;
      flex-shrink: 0;
      box-shadow: inset 0 -4px 8px rgba(0,0,0,0.06);
      user-select: none;
    }

    /* Sizes */
    .size-sm { width: 22px; height: 22px; font-size: 9px; }
    .size-md { width: 40px; height: 40px; font-size: 14px; }
    .size-lg { width: 92px; height: 92px; font-size: 28px; }

    /* Variants — warm sand (coaches), dark (players), gold (brand/special) */
    .variant-warm { background: linear-gradient(135deg, #d8d3c5 0%, #b8a88a 100%); }
    .variant-dark { background: linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%); }
    .variant-gold { background: linear-gradient(135deg, #c9a961 0%, #a08443 100%); }
  `],
})
export class AvatarComponent {
  @Input({ required: true }) initials!: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() variant: 'warm' | 'dark' | 'gold' = 'warm';

  get displayInitials(): string {
    return this.initials.slice(0, 2).toUpperCase();
  }
}
