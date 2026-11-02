import {
  AfterViewInit, Component, computed, DestroyRef, ElementRef,
  inject, OnDestroy, signal, ViewChild,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from './profile.service';
import { ProgressionService } from '../progression/progression.service';
import { SessionRequestsService } from '../session-requests/session-requests.service';
import { CompletedSessionDto } from '../../core/models/session-request.models';
import { NavComponent } from '../../shared/ui/nav/nav.component';
import { PlayerEditFormComponent } from './player-edit-form.component';
import { CoachEditFormComponent } from './coach-edit-form.component';
import { CoachPlayerProgressionDto } from '../../core/models/progression.models';
import { CoachProfileDto, PlayerProfileDto } from '../../core/models/discovery.models';
import {
  AgeGroup, CoachingStyle, MainGoal,
  SkillLevelGroup, Specialty, Surface, TrainingFrequencyPerDay, UserDto,
} from '../../core/models/auth.models';

type ProfileTab = 'overview' | 'tennis' | 'progression' | 'activity' | 'settings';

interface ToggleState {
  discoverableByCoaches: boolean;
  showInPartnerSearch: boolean;
  publicProfile: boolean;
}

const SKILL_NAMES: Record<number, string> = {
  1: 'Complete Beginner', 2: 'Basic Beginner', 3: 'Recreational Beginner',
  4: 'Developing Player', 5: 'Regular Player', 6: 'Strong Club Player',
  7: 'Competitive National', 8: 'High-Level Competitive', 9: 'Near-Professional', 10: 'Professional',
};
const SKILL_DESCS: Record<number, string> = {
  1: 'Never played tennis before.',
  2: 'Tried tennis, knows basic rules, can make contact.',
  3: 'Plays casually with no structured training.',
  4: 'Trains or has trained, rallies but lacks consistency.',
  5: 'Plays consistently with solid fundamentals.',
  6: 'Trains regularly, competes at club level.',
  7: 'Competes in national tournaments and leagues.',
  8: 'Top national or starting international level.',
  9: 'Near professional, very high competitive level.',
  10: 'Professional player earning from tennis.',
};

const CIRC_LG = 351.86; // r=56
const CIRC_SM = 157.08; // r=25

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NavComponent, RouterLink, PlayerEditFormComponent, CoachEditFormComponent],
  template: `
    <app-nav />

    <main class="page">

      <div class="breadcrumb">
        <a routerLink="/dashboard">Overview</a>
        <span class="chev">›</span>
        <span class="current">Profile</span>
      </div>

      <!-- ── Loading ── -->
      @if (profileData() === undefined) {
        <div class="state-msg">Loading profile…</div>
      }

      <!-- ── Not found ── -->
      @else if (profileData() === null) {
        <div class="state-msg">
          Profile not found.
          <a routerLink="/onboarding" class="state-link">Complete your profile →</a>
        </div>
      }

      <!-- ── Profile ── -->
      @else {

        <!-- Profile header -->
        <div class="profile-head">

          <div class="avatar-xl">
            <svg viewBox="0 0 120 120">
              <circle class="av-ring-track" cx="60" cy="60" r="56" transform="rotate(-90 60 60)" />
              <circle class="av-ring-fg" cx="60" cy="60" r="56"
                      transform="rotate(-90 60 60)"
                      [attr.stroke-dasharray]="CIRC_LG"
                      [attr.stroke-dashoffset]="avatarRingOffset()" />
            </svg>
            <div class="av">{{ initials() }}</div>
          </div>

          <div class="ph-info">
            <h1 class="ph-name">{{ user.firstName }} {{ user.lastName }}</h1>
            <div class="ph-meta">
              <span>{{ user.city }}</span>
              <span class="sep"></span>
              <span>Member since {{ memberSince() }}</span>
              @if (user.role === 'Player' && playerProfile(); as p) {
                <span class="sep"></span>
                <span>{{ handLabel(p.preferredHand) }}-handed · {{ backhandLabel(p.backhandType) }} backhand</span>
              }
              @if (user.role === 'Coach' && coachProfile(); as c) {
                <span class="sep"></span>
                <span>{{ c.yearsCoaching }} yr{{ c.yearsCoaching !== 1 ? 's' : '' }} coaching</span>
              }
            </div>
            <div class="ph-tags">
              @if (user.role === 'Player' && playerProfile(); as p) {
                <span class="ph-tag skill">
                  <span class="dot gold-dot"></span>
                  Skill {{ p.skillLevel }} · {{ skillName(p.skillLevel) }}
                </span>
                <span class="ph-tag">
                  <span class="dot"></span>
                  {{ p.yearsPlaying }} yr{{ p.yearsPlaying !== 1 ? 's' : '' }} playing
                </span>
                <span class="ph-tag">
                  <span class="dot"></span>
                  {{ surfaceLabel(p.preferredSurface) }}
                </span>
              }
              @if (user.role === 'Coach' && coachProfile(); as c) {
                <span class="ph-tag skill">
                  <span class="dot gold-dot"></span>
                  {{ coachingStyleLabel(c.trainingStyle) }} style
                </span>
                <span class="ph-tag">
                  <span class="dot"></span>
                  {{ formatRate(c.hourlyRate) }} MKD/hr
                </span>
                <span class="ph-tag" [class.accepting]="c.acceptingNewPlayers">
                  <span class="dot"></span>
                  {{ c.acceptingNewPlayers ? 'Accepting players' : 'Not accepting' }}
                </span>
              }
            </div>
          </div>

          <div class="ph-actions">
            <button class="btn btn-primary" (click)="editing.set(true)">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M8.5 2l2.5 2.5L5 10.5l-3 .5.5-3L8.5 2Z"
                      stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
              </svg>
              Edit profile
            </button>
            <button class="btn btn-secondary" (click)="shareProfile()">
              @if (copied) { Link copied! } @else { Share profile }
            </button>
          </div>

        </div><!-- /profile-head -->

        <!-- ── Success banner ── -->
        @if (saveSuccess()) {
          <div class="save-banner">Profile saved successfully.</div>
        }

        <!-- ── Edit forms ── -->
        @if (editing()) {
          @if (user.role === 'Player' && playerProfile(); as p) {
            <app-player-edit-form
              [initialData]="p"
              (saved)="onSaved($event)"
              (cancelled)="editing.set(false)"
            />
          }
          @if (user.role === 'Coach' && coachProfile(); as c) {
            <app-coach-edit-form
              [initialData]="c"
              (saved)="onSaved($event)"
              (cancelled)="editing.set(false)"
            />
          }
        }

        <!-- ── Tabbed view ── -->
        @else {

          <div class="tabbar">
            @for (tab of tabs; track tab.id) {
              <button class="tab" [class.active]="activeTab() === tab.id"
                      (click)="switchTab(tab.id)">
                {{ tab.label }}<span class="underline"></span>
              </button>
            }
          </div>

          <!-- ═══ OVERVIEW ═══ -->
          @if (activeTab() === 'overview') {
            <div class="panel">

              <!-- Stat tiles — this month -->
              <div class="stat-section-label">This month</div>
              @if (user.role === 'Coach') {
                <div class="stat-tiles cols-2">
                  <div class="stat-tile">
                    <div class="st-label">Hours coached</div>
                    <div class="st-value">{{ hoursDisplay(coachHoursThisMonth()) }}<span class="st-suf">h</span></div>
                    <div class="st-sub">this month</div>
                  </div>
                  <div class="stat-tile">
                    <div class="st-label">Sessions held</div>
                    <div class="st-value">{{ coachSessionsThisMonth() }}</div>
                    <div class="st-sub">this month</div>
                  </div>
                </div>
              } @else {
                <div class="stat-tiles">
                  <div class="stat-tile">
                    <div class="st-label">Hours played</div>
                    <div class="st-value">{{ hoursDisplay(hoursThisMonth()) }}<span class="st-suf">h</span></div>
                    <div class="st-sub">this month</div>
                  </div>
                  <div class="stat-tile">
                    <div class="st-label">Sessions</div>
                    <div class="st-value">{{ sessionsThisMonth() }}</div>
                    <div class="st-sub">this month</div>
                  </div>
                  <div class="stat-tile">
                    <div class="st-label">With a coach</div>
                    <div class="st-value">{{ coachSessionsThisMonth() }}</div>
                    <div class="st-sub">this month</div>
                  </div>
                  <div class="stat-tile">
                    <div class="st-label">With a player</div>
                    <div class="st-value">{{ playerSessionsThisMonth() }}</div>
                    <div class="st-sub">this month</div>
                  </div>
                </div>
              }

              <div class="grid-2-wide">

                <!-- About card -->
                <div class="card card-pad">
                  <div class="card-h">
                    <span class="card-label">About</span>
                    <button class="card-edit" (click)="editing.set(true)">Edit</button>
                  </div>

                  @if (user.role === 'Player' && playerProfile(); as p) {
                    @if (p.bio) {
                      <p class="bio-text">{{ p.bio }}</p>
                    } @else {
                      <p class="bio-text bio-empty">No bio yet.</p>
                    }

                    <div class="card-h section-h">
                      <span class="card-label">Main goals</span>
                    </div>
                    <div class="chips">
                      @for (g of p.mainGoals; track g) {
                        <span class="chip gold-chip">{{ goalLabel(g) }}</span>
                      }
                    </div>

                    <div class="card-h section-h">
                      <span class="card-label">Inspiration</span>
                    </div>
                    <div class="def-row bordered-top">
                      <span class="def-k">Favorite player</span>
                      <span class="def-v" [class.def-muted]="p.favoritePlayerNone || !p.favoritePlayer">
                        {{ p.favoritePlayerNone || !p.favoritePlayer ? 'Not set' : p.favoritePlayer }}
                      </span>
                    </div>
                    <div class="def-row">
                      <span class="def-k">Plays like</span>
                      <span class="def-v" [class.def-muted]="p.wantsToPlayLikeNone || !p.wantsToPlayLike">
                        {{ p.wantsToPlayLikeNone || !p.wantsToPlayLike ? 'Not set' : p.wantsToPlayLike }}
                      </span>
                    </div>
                  }

                  @if (user.role === 'Coach' && coachProfile(); as c) {
                    @if (c.bio) {
                      <p class="bio-text">{{ c.bio }}</p>
                    } @else {
                      <p class="bio-text bio-empty">No bio yet.</p>
                    }

                    <div class="card-h section-h">
                      <span class="card-label">Specialties</span>
                    </div>
                    <div class="chips">
                      @for (s of c.specialties; track s) {
                        <span class="chip gold-chip">{{ specialtyLabel(s) }}</span>
                      }
                    </div>
                  }
                </div>

                <!-- Progression snapshot -->
                <div class="card card-pad">
                  <div class="card-h">
                    <span class="card-label">Progression</span>
                    <button class="card-edit" (click)="switchTab('progression')">View all</button>
                  </div>

                  @for (prog of topThree(); track prog.relationshipId) {
                    <div class="cp-row">
                      <div class="cp-ring-wrap">
                        <svg viewBox="0 0 60 60">
                          <circle class="cp-bg" cx="30" cy="30" r="25" transform="rotate(-90 30 30)" />
                          <circle class="cp-fg" cx="30" cy="30" r="25"
                                  transform="rotate(-90 30 30)"
                                  [attr.stroke-dasharray]="CIRC_SM"
                                  [attr.stroke-dashoffset]="smallRingOffset(prog)" />
                        </svg>
                        <div class="cp-av">{{ progInitials(prog) }}</div>
                      </div>
                      <div class="cp-info">
                        <p class="cp-name">{{ prog.counterpartFirstName }} {{ prog.counterpartLastName }}</p>
                      </div>
                      <div class="cp-right">
                        <div class="cp-tier" [class.cp-tier-muted]="prog.currentLevel === 0">
                          {{ tierLabel(prog.currentLevel, prog.discountPercent) }}
                        </div>
                        <div class="cp-hours">{{ prog.totalHours }}h · {{ hoursToNext(prog) }}</div>
                      </div>
                    </div>
                  }

                  @if (!progression().length) {
                    <p class="empty-note">No progression data yet.</p>
                  }
                </div>

              </div><!-- /grid-2-wide -->

              <!-- Stat cards row — all time -->
              <div class="stat-section-label stat-section-label-lower">All time</div>
              @if (user.role === 'Coach') {
                <div class="stat-row cols-2">
                  <div class="stat">
                    <div class="stat-lab">Hours coached</div>
                    <div class="stat-val">{{ hoursDisplay(coachHoursAllTime()) }}h</div>
                    <div class="stat-trend">All time</div>
                  </div>
                  <div class="stat">
                    <div class="stat-lab">Sessions held</div>
                    <div class="stat-val">{{ coachSessionsAllTime() }}</div>
                    <div class="stat-trend">
                      @if (coachSessionsAllTime() === 0) { No sessions yet } @else { All time }
                    </div>
                  </div>
                </div>
              } @else {
                <div class="stat-row">
                  <div class="stat">
                    <div class="stat-lab">Hours played</div>
                    <div class="stat-val">{{ hoursDisplay(hoursAllTime()) }}h</div>
                    <div class="stat-trend">All time</div>
                  </div>
                  <div class="stat">
                    <div class="stat-lab">Sessions</div>
                    <div class="stat-val">{{ sessionsAllTime() }}</div>
                    <div class="stat-trend">
                      @if (sessionsAllTime() === 0) { No sessions yet } @else { All time }
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-lab">With a coach</div>
                    <div class="stat-val">{{ coachSessionsAllTime() }}</div>
                    <div class="stat-trend">All time</div>
                  </div>
                  <div class="stat">
                    <div class="stat-lab">With a player</div>
                    <div class="stat-val">{{ playerSessionsAllTime() }}</div>
                    <div class="stat-trend">All time</div>
                  </div>
                </div>
              }

            </div><!-- /overview panel -->
          }

          <!-- ═══ TENNIS / COACHING PROFILE ═══ -->
          @if (activeTab() === 'tennis') {
            <div class="panel">

              @if (user.role === 'Player' && playerProfile(); as p) {

                <!-- Skill level - full width -->
                <div class="card card-pad full-card">
                  <div class="card-h">
                    <span class="card-label">Skill level</span>
                    <button class="card-edit" (click)="editing.set(true)">Edit</button>
                  </div>
                  <div class="skill-head">
                    <span class="skill-num">{{ p.skillLevel }}</span>
                    <span class="skill-name">{{ skillName(p.skillLevel) }}</span>
                    <span class="skill-of">{{ p.skillLevel }} / 10</span>
                  </div>
                  <div class="skill-bar">
                    <div class="skill-track"></div>
                    <div class="skill-fill"
                         [style.width.%]="skillFillPct(p.skillLevel)"></div>
                    <div class="skill-dots">
                      @for (i of TEN; track i) {
                        <span class="skill-dot"
                              [class.reached]="i < p.skillLevel"
                              [class.current]="i === p.skillLevel"></span>
                      }
                    </div>
                  </div>
                  <div class="skill-scale">
                    @for (i of TEN; track i) { <span>{{ i }}</span> }
                  </div>
                  <p class="skill-desc">{{ skillDesc(p.skillLevel) }}</p>
                </div>

                <div class="grid-2">

                  <!-- Basic profile -->
                  <div class="card card-pad">
                    <div class="card-h">
                      <span class="card-label">Basic profile</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top"><span class="def-k">Date of birth</span><span class="def-v">{{ formatDob(p.dateOfBirth) }}</span></div>
                    <div class="def-row"><span class="def-k">Age</span><span class="def-v">{{ computeAge(p.dateOfBirth) }}</span></div>
                    <div class="def-row"><span class="def-k">Preferred hand</span><span class="def-v">{{ handLabel(p.preferredHand) }}</span></div>
                    <div class="def-row"><span class="def-k">Backhand</span><span class="def-v">{{ backhandLabel(p.backhandType) }}</span></div>
                    <div class="def-row"><span class="def-k">Years playing</span><span class="def-v">{{ p.yearsPlaying }} yr{{ p.yearsPlaying !== 1 ? 's' : '' }}</span></div>
                  </div>

                  <!-- Training preferences -->
                  <div class="card card-pad">
                    <div class="card-h">
                      <span class="card-label">Training preferences</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top"><span class="def-k">Days per week</span><span class="def-v">{{ p.trainingDaysPerWeek }}</span></div>
                    <div class="def-row"><span class="def-k">Frequency</span><span class="def-v">{{ freqLabel(p.trainingFrequencyPerDay) }}</span></div>
                    <div class="def-row"><span class="def-k">Session length</span><span class="def-v">{{ p.preferredSessionDurationMinutes }} min</span></div>
                    <div class="def-row"><span class="def-k">Coaching style</span><span class="def-v">{{ coachingStyleLabel(p.preferredCoachingStyle) }}</span></div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Preferred surface</span>
                      <span class="def-v">{{ surfaceLabel(p.preferredSurface) }}</span>
                    </div>
                  </div>

                  <!-- Goals & inspiration - full width -->
                  <div class="card card-pad full-card">
                    <div class="card-h">
                      <span class="card-label">Goals &amp; inspiration</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top def-row-stack">
                      <span class="def-k">Main goals</span>
                      <div class="chips chips-mt">
                        @for (g of p.mainGoals; track g) {
                          <span class="chip gold-chip">{{ goalLabel(g) }}</span>
                        }
                      </div>
                    </div>
                    <div class="def-row"><span class="def-k">Favorite player</span>
                      <span class="def-v" [class.def-muted]="p.favoritePlayerNone || !p.favoritePlayer">
                        {{ p.favoritePlayerNone || !p.favoritePlayer ? 'Not set' : p.favoritePlayer }}
                      </span>
                    </div>
                    <div class="def-row"><span class="def-k">I'd like to play like</span>
                      <span class="def-v" [class.def-muted]="p.wantsToPlayLikeNone || !p.wantsToPlayLike">
                        {{ p.wantsToPlayLikeNone || !p.wantsToPlayLike ? 'Not set' : p.wantsToPlayLike }}
                      </span>
                    </div>
                  </div>

                </div><!-- /grid-2 -->
              }

              @if (user.role === 'Coach' && coachProfile(); as c) {
                <div class="grid-2">

                  <!-- Background - full width -->
                  <div class="card card-pad full-card">
                    <div class="card-h">
                      <span class="card-label">Coaching background</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top"><span class="def-k">Years coaching</span><span class="def-v">{{ c.yearsCoaching }} yr{{ c.yearsCoaching !== 1 ? 's' : '' }}</span></div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Diplomas &amp; qualifications</span>
                      <span class="def-v def-v-block">{{ c.diplomas }}</span>
                    </div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Coaching history</span>
                      <span class="def-v def-v-block">{{ c.coachingHistory }}</span>
                    </div>
                  </div>

                  <!-- Style -->
                  <div class="card card-pad">
                    <div class="card-h">
                      <span class="card-label">Coaching style</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top"><span class="def-k">Training style</span><span class="def-v">{{ coachingStyleLabel(c.trainingStyle) }}</span></div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Specialties</span>
                      <div class="chips chips-mt">
                        @for (s of c.specialties; track s) {
                          <span class="chip gold-chip">{{ specialtyLabel(s) }}</span>
                        }
                      </div>
                    </div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Preferred surfaces</span>
                      <div class="chips chips-mt">
                        @for (s of c.preferredSurfaces; track s) {
                          <span class="chip">{{ surfaceLabel(s) }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Player fit -->
                  <div class="card card-pad">
                    <div class="card-h">
                      <span class="card-label">Player fit</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top def-row-stack">
                      <span class="def-k">Skill level groups</span>
                      <div class="chips chips-mt">
                        @for (g of c.skillLevelGroups; track g) {
                          <span class="chip">{{ skillGroupLabel(g) }}</span>
                        }
                      </div>
                    </div>
                    <div class="def-row def-row-stack">
                      <span class="def-k">Age groups</span>
                      <div class="chips chips-mt">
                        @for (g of c.ageGroups; track g) {
                          <span class="chip">{{ ageGroupLabel(g) }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Pricing -->
                  <div class="card card-pad">
                    <div class="card-h">
                      <span class="card-label">Pricing &amp; availability</span>
                      <button class="card-edit" (click)="editing.set(true)">Edit</button>
                    </div>
                    <div class="def-row bordered-top"><span class="def-k">Hourly rate</span><span class="def-v">{{ formatRate(c.hourlyRate) }} MKD</span></div>
                    <div class="def-row"><span class="def-k">Accepting new players</span>
                      <span class="def-v" [class.accepting-yes]="c.acceptingNewPlayers"
                            [class.accepting-no]="!c.acceptingNewPlayers">
                        {{ c.acceptingNewPlayers ? 'Yes' : 'No' }}
                      </span>
                    </div>
                  </div>

                </div><!-- /grid-2 coach -->
              }

            </div><!-- /tennis panel -->
          }

          <!-- ═══ PROGRESSION ═══ -->
          @if (activeTab() === 'progression') {
            <div class="panel">
              <div class="card card-pad">
                <div class="card-h">
                  <span class="card-label">
                    Loyalty progression · {{ user.role === 'Player' ? 'by coach' : 'by player' }}
                  </span>
                  <span class="card-hint">100h → 10% · 175h → 20% · 300h → 30%</span>
                </div>

                @if (progression().length) {
                  @for (prog of progression()!; track prog.relationshipId) {
                    <div class="cp-row cp-row-lg">
                      <div class="cp-ring-wrap">
                        <svg viewBox="0 0 60 60">
                          <circle class="cp-bg" cx="30" cy="30" r="25" transform="rotate(-90 30 30)" />
                          <circle class="cp-fg" cx="30" cy="30" r="25"
                                  transform="rotate(-90 30 30)"
                                  [attr.stroke-dasharray]="CIRC_SM"
                                  [attr.stroke-dashoffset]="smallRingOffset(prog)" />
                        </svg>
                        <div class="cp-av">{{ progInitials(prog) }}</div>
                      </div>
                      <div class="cp-info">
                        <p class="cp-name">{{ prog.counterpartFirstName }} {{ prog.counterpartLastName }}</p>
                        <p class="cp-since">
                          {{ hoursToNext(prog) }}
                        </p>
                      </div>
                      <div class="cp-right">
                        <div class="cp-tier" [class.cp-tier-muted]="prog.currentLevel === 0">
                          {{ tierLabel(prog.currentLevel, prog.discountPercent) }}
                        </div>
                        <div class="cp-hours">{{ prog.totalHours }}h total</div>
                      </div>
                    </div>
                  }
                } @else {
                  <p class="empty-note">No progression data yet. Complete sessions to start earning loyalty tiers.</p>
                }
              </div>
            </div>
          }

          <!-- ═══ ACTIVITY ═══ -->
          @if (activeTab() === 'activity') {
            <div class="panel">
              <div class="card card-pad">
                <div class="card-h">
                  <span class="card-label">Session history</span>
                </div>

                <!-- Date range filter -->
                <div class="act-filter">
                  <div class="act-filter-field">
                    <label class="act-filter-lab" for="act-from">From</label>
                    <input id="act-from" type="date" class="act-date"
                           [value]="activityFrom()"
                           [max]="activityTo() || null"
                           (change)="onActivityFromChange($event)" />
                  </div>
                  <div class="act-filter-field">
                    <label class="act-filter-lab" for="act-to">To</label>
                    <input id="act-to" type="date" class="act-date"
                           [value]="activityTo()"
                           [min]="activityFrom() || null"
                           (change)="onActivityToChange($event)" />
                  </div>
                  <div class="act-filter-actions">
                    <button class="btn btn-primary btn-sm" (click)="applyActivityFilter()">Apply</button>
                    <button class="btn btn-secondary btn-sm"
                            [disabled]="!activityFrom() && !activityTo()"
                            (click)="clearActivityFilter()">Clear</button>
                  </div>
                </div>

                @if (activityLoading()) {
                  <div class="act-loading">Loading activity…</div>
                } @else if (activitySessions().length) {
                  @for (s of activitySessions(); track s.id) {
                    <div class="act-row">
                      <div class="act-dot" [class.act-dot-player]="s.sessionType === 'PlayerPlayer'"></div>
                      <div class="act-body">
                        <p class="act-name">{{ s.counterpartFirstName }} {{ s.counterpartLastName }}</p>
                        <p class="act-meta">
                          {{ s.sessionType === 'CoachPlayer' ? 'Coach session' : 'Player session' }}
                          · {{ formatDuration(s.durationMinutes) }}
                          @if (s.tennisClubName) { · {{ s.tennisClubName }} }
                        </p>
                      </div>
                      <div class="act-right">
                        <span class="act-status">Completed</span>
                        <span class="act-date">{{ formatActivityDate(s.proposedDateTime) }}</span>
                      </div>
                    </div>
                  }

                  <div #activitySentinel class="act-sentinel"></div>

                  @if (activityLoadingMore()) {
                    <div class="act-more">Loading more…</div>
                  } @else if (!activityHasMore()) {
                    <div class="act-more act-more-end">No more activity</div>
                  }
                } @else {
                  <div class="empty-state">
                    <div class="empty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </div>
                    <p class="empty-title">No activity yet</p>
                    <p class="empty-sub">
                      @if (activityFiltered()) {
                        No completed sessions in this date range.
                      } @else {
                        Complete sessions to start building your history.
                      }
                    </p>
                  </div>
                }
              </div>
            </div>
          }

          <!-- ═══ SETTINGS ═══ -->
          @if (activeTab() === 'settings') {
            <div class="panel">
              <div class="grid-2">

                <!-- Account -->
                <div class="card card-pad">
                  <div class="card-h"><span class="card-label">Account</span></div>
                  <div class="def-row bordered-top"><span class="def-k">Email</span><span class="def-v">{{ user.email }}</span></div>
                  <div class="def-row"><span class="def-k">Phone</span><span class="def-v">{{ user.phoneNumber }}</span></div>
                  <div class="def-row"><span class="def-k">City</span><span class="def-v">{{ user.city }}</span></div>
                  <div class="settings-btn-row">
                    <a routerLink="/forgot-password" class="btn btn-secondary btn-sm">Change password</a>
                  </div>
                </div>

                <!-- Privacy -->
                <div class="card card-pad">
                  <div class="card-h"><span class="card-label">Privacy</span></div>
                  <div class="settings-row">
                    <div class="settings-text">
                      <div class="settings-title">Discoverable by coaches</div>
                      <div class="settings-sub">Coaches can find and message you</div>
                    </div>
                    <div class="switch" [class.on]="toggles().discoverableByCoaches"
                         (click)="toggle('discoverableByCoaches')" role="switch"
                         [attr.aria-checked]="toggles().discoverableByCoaches"></div>
                  </div>
                  <div class="settings-row">
                    <div class="settings-text">
                      <div class="settings-title">Show in partner search</div>
                      <div class="settings-sub">Appear to players matching your level</div>
                    </div>
                    <div class="switch" [class.on]="toggles().showInPartnerSearch"
                         (click)="toggle('showInPartnerSearch')" role="switch"
                         [attr.aria-checked]="toggles().showInPartnerSearch"></div>
                  </div>
                  <div class="settings-row">
                    <div class="settings-text">
                      <div class="settings-title">Public profile</div>
                      <div class="settings-sub">Anyone with the link can view</div>
                    </div>
                    <div class="switch" [class.on]="toggles().publicProfile"
                         (click)="toggle('publicProfile')" role="switch"
                         [attr.aria-checked]="toggles().publicProfile"></div>
                  </div>
                </div>

              </div>
            </div>
          }

        }<!-- /tabbed view -->

      }<!-- /profile loaded -->

    </main>
  `,
  styles: [`
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 32px 80px;
    }

    /* ── Breadcrumb ── */
    .breadcrumb {
      display: flex; align-items: center; gap: 8px;
      padding: 22px 0 0;
      font-size: 13px;
      color: var(--color-text-secondary);

      a { color: var(--color-text-secondary); text-decoration: none; transition: color var(--transition-fast); }
      a:hover { color: var(--color-ink); }
      .chev { color: var(--color-muted-3); }
      .current { color: var(--color-ink); }
    }

    /* ── State messages ── */
    .state-msg {
      padding: 80px 0;
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .state-link {
      color: var(--color-gold);
      font-weight: var(--font-medium);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }

    /* ── Profile header ── */
    .profile-head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 28px;
      align-items: center;
      padding: 32px 0 28px;
    }

    .avatar-xl {
      position: relative;
      width: 120px; height: 120px;
      flex-shrink: 0;

      svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }

      .av-ring-track { fill: none; stroke: var(--color-line); stroke-width: 3; }
      .av-ring-fg {
        fill: none; stroke: var(--color-gold); stroke-width: 3;
        stroke-linecap: round;
        filter: drop-shadow(0 0 5px rgba(201,169,97,0.3));
        transition: stroke-dashoffset 1.3s var(--ease-smooth);
      }
    }
    .av {
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2b2b2b, #111);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 38px; font-weight: var(--font-medium);
      letter-spacing: -0.02em;
      box-shadow: inset 0 -10px 24px rgba(0,0,0,0.18);
    }

    .ph-info { min-width: 0; }
    .ph-name {
      font-size: 32px;
      font-weight: var(--font-semibold);
      letter-spacing: -0.03em;
      margin: 0 0 6px;
      line-height: 1.1;
      color: var(--color-ink);
    }
    .ph-meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin-bottom: 14px;
      .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--color-muted-3); }
    }
    .ph-tags {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .ph-tag {
      height: 28px;
      padding: 0 12px;
      border-radius: var(--radius-full);
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      font-size: 12.5px;
      color: var(--color-ink);
      display: inline-flex; align-items: center; gap: 6px;
      letter-spacing: -0.005em;
    }
    .dot {
      width: 5px; height: 5px; border-radius: 50%; background: var(--color-muted-3);
    }
    .gold-dot { background: var(--color-gold); }
    .accepting { border-color: var(--color-gold-line); }

    .ph-actions {
      display: flex; flex-direction: column; gap: 8px;
      align-items: stretch;
    }

    /* ── Buttons ── */
    .btn {
      height: 40px; padding: 0 18px;
      border-radius: 10px;
      font-size: 13.5px; font-weight: var(--font-medium);
      letter-spacing: -0.005em;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      transition: background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
      white-space: nowrap; cursor: pointer; text-decoration: none;
      font-family: var(--font-sans);
    }
    .btn-primary {
      background: var(--color-ink); color: #fff; border: none;
      &:hover { background: #000; box-shadow: 0 4px 14px rgba(17,17,17,0.18); }
      &:active { transform: scale(0.985); }
    }
    .btn-secondary {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      color: var(--color-ink);
      &:hover { background: rgba(17,17,17,0.025); }
    }
    .btn-sm { height: 32px; padding: 0 13px; border-radius: 8px; font-size: 12.5px; }

    /* ── Save banner ── */
    .save-banner {
      background: var(--color-success-light);
      border: 1px solid var(--color-success);
      color: var(--color-success);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      margin-bottom: 16px;
      animation: fade-up 0.3s var(--ease-smooth) both;
    }

    /* ── Tab bar ── */
    .tabbar {
      display: flex; gap: 2px;
      border-bottom: 1px solid var(--color-border-subtle);
      margin-bottom: 28px;
      position: sticky;
      top: 0;
      background: var(--color-bg);
      z-index: 20;
      overflow-x: auto;
    }
    .tab {
      position: relative;
      height: 44px;
      padding: 0 16px;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      letter-spacing: -0.005em;
      transition: color var(--transition-fast);
      cursor: pointer;
      background: none; border: none;
      font-family: var(--font-sans);
      &:hover { color: var(--color-ink); }
      &.active { color: var(--color-ink); }
    }
    .underline {
      position: absolute;
      left: 12px; right: 12px; bottom: -1px;
      height: 2px;
      background: var(--color-ink);
      border-radius: 2px;
      transform: scaleX(0);
      transition: transform 0.25s var(--ease-smooth);
    }
    .tab.active .underline { transform: scaleX(1); }

    /* ── Panels ── */
    .panel {
      animation: fade-up 0.35s var(--ease-smooth) both;
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Grid layouts ── */
    .grid-2 {
      display: grid;
      grid-template-columns: minmax(0,1fr) minmax(0,1fr);
      gap: 20px;
    }
    .grid-2-wide {
      display: grid;
      grid-template-columns: minmax(0,1.4fr) minmax(0,1fr);
      gap: 20px;
    }
    .full-card { grid-column: 1 / -1; }

    /* ── Cards ── */
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .card-pad { padding: 24px; }
    .card-h {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px;
    }
    .section-h { margin-top: 20px; margin-bottom: 14px; }
    .card-label {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.08em; text-transform: uppercase;
      font-weight: var(--font-medium);
    }
    .card-hint {
      font-size: 12px; color: var(--color-muted-2);
    }
    .card-edit {
      font-size: 12px;
      color: var(--color-gold);
      letter-spacing: 0.01em;
      font-weight: var(--font-medium);
      cursor: pointer;
      background: none; border: none;
      font-family: var(--font-sans);
      transition: color var(--transition-fast);
      &:hover { color: #a08443; }
    }

    /* ── Def rows ── */
    .def-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      padding: 11px 0;
      border-bottom: 1px solid var(--color-line-3);
      font-size: var(--text-sm);
      &:last-child { border-bottom: none; }
    }
    .def-row.bordered-top { border-top: 1px solid var(--color-line-3); }
    .def-row.def-row-stack { grid-template-columns: 1fr; gap: 10px; }
    .def-k { color: var(--color-text-secondary); }
    .def-v {
      color: var(--color-ink);
      font-weight: var(--font-medium);
      letter-spacing: -0.005em;
      text-align: right;
    }
    .def-v.def-muted { color: var(--color-muted-3); font-weight: var(--font-normal); }
    .def-v.def-v-block { text-align: left; font-weight: var(--font-normal); line-height: 1.6; }
    .accepting-yes { color: var(--color-success); }
    .accepting-no  { color: var(--color-text-secondary); }

    /* ── Bio ── */
    .bio-text {
      margin: 0 0 4px;
      font-size: 15px;
      color: var(--color-ink);
      line-height: 1.6;
      letter-spacing: -0.005em;
    }
    .bio-empty { color: var(--color-text-secondary); font-style: italic; }

    /* ── Chips ── */
    .chips { display: flex; flex-wrap: wrap; gap: 7px; }
    .chips-mt { margin-top: 4px; }
    .chip {
      height: 30px;
      padding: 0 12px;
      border-radius: var(--radius-full);
      background: var(--color-line-subtle);
      font-size: 12.5px;
      color: var(--color-ink);
      display: inline-flex; align-items: center;
      letter-spacing: -0.005em;
    }
    .gold-chip {
      background: var(--color-gold-soft);
      color: var(--color-gold);
      font-weight: var(--font-medium);
    }

    /* ── Stat tiles ── */
    .stat-tiles {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-tiles.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
    .stat-tile {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 18px;
      box-shadow: var(--shadow-sm);
    }
    .st-label {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.06em; text-transform: uppercase;
      font-weight: var(--font-medium); margin-bottom: 8px;
    }
    .st-value {
      font-size: 26px; font-weight: var(--font-semibold);
      letter-spacing: -0.025em; line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--color-ink);
    }
    .st-suf { font-size: 13px; color: var(--color-text-secondary); font-weight: var(--font-normal); margin-left: 2px; }
    .st-sub {
      margin-top: 7px;
      font-family: var(--font-mono);
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.02em;
    }

    /* ── Stat row (session stats) ── */
    .stat-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 20px;
    }
    .stat-row.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
    .stat {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 18px;
      box-shadow: var(--shadow-sm);
    }
    .stat-lab {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.06em; text-transform: uppercase;
      font-weight: var(--font-medium); margin-bottom: 8px;
    }
    .stat-val {
      font-size: 26px; font-weight: var(--font-semibold);
      letter-spacing: -0.025em; line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--color-ink);
    }
    .stat-trend {
      margin-top: 7px;
      font-family: var(--font-mono);
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.02em;
    }

    /* ── Stat section labels ── */
    .stat-section-label {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.08em; text-transform: uppercase;
      font-weight: var(--font-medium);
      margin: 0 0 10px 2px;
    }
    .stat-section-label-lower { margin-top: 24px; }

    /* ── Activity: date filter ── */
    .act-filter {
      display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px;
      padding: 4px 0 16px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--color-line-3);
    }
    .act-filter-field { display: flex; flex-direction: column; gap: 5px; }
    .act-filter-lab {
      font-size: 11px; color: var(--color-muted-2);
      letter-spacing: 0.06em; text-transform: uppercase;
      font-weight: var(--font-medium);
    }
    .act-date {
      font-family: inherit; font-size: 13px;
      color: var(--color-ink);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      transition: border-color var(--transition-fast);
    }
    .act-date:focus { outline: none; border-color: var(--color-gold); }
    .act-filter-actions { display: flex; gap: 8px; margin-left: auto; }

    /* ── Activity: session rows ── */
    .act-row {
      display: flex; align-items: center; gap: 14px;
      padding: 13px 0;
      border-bottom: 1px solid var(--color-line-3);
      &:last-of-type { border-bottom: none; }
    }
    .act-dot {
      flex-shrink: 0;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-gold);
    }
    .act-dot-player { background: var(--color-muted-3); }
    .act-body { flex: 1; min-width: 0; }
    .act-name {
      font-size: var(--text-sm); font-weight: var(--font-medium);
      color: var(--color-ink); letter-spacing: -0.005em;
      margin: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .act-meta {
      font-size: var(--text-xs); color: var(--color-muted-2);
      margin: 2px 0 0; letter-spacing: 0.02em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .act-right {
      flex-shrink: 0;
      display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
    }
    .act-status {
      font-size: 10px; font-weight: var(--font-medium);
      letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--color-gold);
    }
    .act-date {
      font-size: var(--text-xs); color: var(--color-muted-2);
      font-family: var(--font-mono); letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .act-sentinel { height: 1px; }
    .act-loading, .act-more {
      padding: 16px 0 4px; text-align: center;
      font-size: 12.5px; color: var(--color-text-secondary);
      font-family: var(--font-mono); letter-spacing: 0.02em;
    }
    .act-more-end { color: var(--color-muted-3); }

    /* ── Skill level display ── */
    .skill-head {
      display: flex; align-items: baseline; gap: 12px;
      margin-bottom: 16px;
    }
    .skill-num {
      font-size: 30px; font-weight: var(--font-semibold);
      letter-spacing: -0.03em; line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--color-ink);
    }
    .skill-name {
      font-size: var(--text-sm); font-weight: var(--font-semibold);
      color: var(--color-ink); letter-spacing: -0.01em;
    }
    .skill-of {
      font-size: 13px; color: var(--color-muted-2);
      margin-left: auto;
      font-family: var(--font-mono);
      letter-spacing: 0.04em;
    }
    .skill-bar {
      position: relative;
      height: 10px;
      margin: 0 4px;
    }
    .skill-track {
      position: absolute;
      top: 50%; left: 0; right: 0;
      height: 3px;
      background: var(--color-border);
      transform: translateY(-50%);
      border-radius: 2px;
    }
    .skill-fill {
      position: absolute;
      top: 50%; left: 0;
      height: 3px;
      background: var(--color-gold);
      transform: translateY(-50%);
      border-radius: 2px;
      width: 0;
      transition: width 1s var(--ease-spring) 0.2s;
    }
    .skill-dots {
      position: relative;
      display: flex; align-items: center; justify-content: space-between;
      height: 100%;
    }
    .skill-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      z-index: 2;
      &.reached { background: var(--color-gold); border-color: var(--color-gold); }
      &.current {
        width: 14px; height: 14px;
        background: var(--color-gold); border-color: var(--color-gold);
        box-shadow: 0 0 0 4px rgba(201,169,97,0.18);
      }
    }
    .skill-scale {
      display: flex; justify-content: space-between;
      margin-top: 10px; padding: 0 1px;
      font-family: var(--font-mono); font-size: 10px;
      color: var(--color-muted-3); letter-spacing: 0.04em;
    }
    .skill-desc {
      margin: 18px 0 0;
      font-size: 13.5px; color: var(--color-text-secondary);
      line-height: 1.55;
    }

    /* ── Progression coach/player rows ── */
    .cp-row {
      display: flex; align-items: center; gap: 18px;
      padding: 16px 0;
      border-bottom: 1px solid var(--color-line-3);
      &:first-of-type { padding-top: 4px; }
      &:last-of-type  { border-bottom: none; padding-bottom: 4px; }
    }
    .cp-row-lg { padding: 18px 0; }
    .cp-ring-wrap {
      position: relative;
      width: 60px; height: 60px;
      flex-shrink: 0;

      svg { width: 100%; height: 100%; }
      .cp-bg { fill: none; stroke: var(--color-line); stroke-width: 4; }
      .cp-fg {
        fill: none; stroke: var(--color-gold); stroke-width: 4;
        stroke-linecap: round;
        transition: stroke-dashoffset 1.1s var(--ease-smooth) 0.15s;
      }
    }
    .cp-av {
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2b2b2b, #1a1a1a);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: var(--font-medium);
      letter-spacing: -0.005em;
    }
    .cp-info { flex: 1; min-width: 0; }
    .cp-name {
      font-size: 14.5px; font-weight: var(--font-semibold);
      letter-spacing: -0.01em; margin: 0;
      color: var(--color-ink);
    }
    .cp-since { font-size: 12px; color: var(--color-muted-2); margin: 2px 0 0; }
    .cp-right { text-align: right; flex-shrink: 0; }
    .cp-tier {
      font-size: 12px; font-weight: var(--font-semibold);
      color: var(--color-gold);
      font-family: var(--font-mono);
      letter-spacing: 0.02em;
      display: inline-flex; align-items: center; gap: 5px;
      &::before {
        content: "";
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--color-gold);
      }
    }
    .cp-tier-muted {
      color: var(--color-muted-2);
      &::before { background: var(--color-muted-3); }
    }
    .cp-hours {
      font-size: 11.5px; color: var(--color-muted-2);
      font-family: var(--font-mono);
      margin-top: 4px;
    }
    .empty-note {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      padding: 12px 0;
    }

    /* ── Activity event rows ── */
    .event-row {
      display: flex; align-items: center; gap: 14px;
      padding: 13px 0;
      border-bottom: 1px solid var(--color-line-3);
      &:last-child { border-bottom: none; }
    }
    .event-dot {
      flex-shrink: 0;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-gold);
    }
    .event-dot-muted { background: var(--color-muted-3); }
    .event-body { flex: 1; min-width: 0; }
    .event-desc {
      font-size: var(--text-sm); font-weight: var(--font-medium);
      color: var(--color-ink); letter-spacing: -0.005em;
      margin: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .event-type {
      font-size: var(--text-xs); color: var(--color-muted-2);
      margin: 2px 0 0; letter-spacing: 0.02em;
    }
    .event-date {
      flex-shrink: 0;
      font-size: var(--text-xs); color: var(--color-muted-2);
      font-family: var(--font-mono); letter-spacing: 0.02em;
      white-space: nowrap;
    }

    /* ── Activity empty state ── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px;
      padding: 40px 24px;
      text-align: center;
    }
    .empty-icon {
      width: 48px; height: 48px;
      border-radius: var(--radius-md);
      background: var(--color-line-subtle);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-text-secondary);
    }
    .empty-title {
      font-size: var(--text-sm); font-weight: var(--font-medium);
      color: var(--color-ink);
    }
    .empty-sub {
      font-size: 12.5px; color: var(--color-text-secondary);
      max-width: 280px; line-height: 1.5;
    }

    /* ── Settings ── */
    .settings-btn-row { margin-top: 16px; }
    .settings-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
      border-bottom: 1px solid var(--color-line-3);
      &:last-child { border-bottom: none; }
    }
    .settings-row-border { border-top: 1px solid var(--color-line-3); margin-top: 8px; }
    .settings-text { min-width: 0; }
    .settings-title { font-size: var(--text-sm); font-weight: var(--font-medium); letter-spacing: -0.005em; }
    .settings-sub { font-size: 12.5px; color: var(--color-text-secondary); margin-top: 2px; }

    .switch {
      position: relative;
      width: 44px; height: 26px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.25s var(--ease-smooth);
      &::after {
        content: "";
        position: absolute;
        top: 3px; left: 3px;
        width: 20px; height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(17,17,17,0.2);
        transition: left 0.3s var(--ease-spring);
      }
      &.on { background: var(--color-ink); }
      &.on::after { left: 21px; }
    }

    /* ── Responsive ── */
    @media (max-width: 880px) {
      .grid-2, .grid-2-wide { grid-template-columns: 1fr; }
      .stat-tiles { grid-template-columns: 1fr 1fr; }
      .stat-row { grid-template-columns: 1fr 1fr; }
      .profile-head { grid-template-columns: auto 1fr; }
      .ph-actions { grid-column: 1 / -1; flex-direction: row; }
      .ph-actions .btn { flex: 1; }
      .full-card { grid-column: 1; }
    }
    @media (max-width: 600px) {
      .page { padding: 0 18px 60px; }
      .stat-tiles { grid-template-columns: 1fr 1fr; }
      .stat-row { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class ProfileComponent implements AfterViewInit, OnDestroy {
  @ViewChild('activitySentinel') private activitySentinelRef?: ElementRef<HTMLElement>;

  private readonly authService   = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly progressionService = inject(ProgressionService);
  private readonly sessionRequestsService = inject(SessionRequestsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.authService.currentUser!;

  readonly activeTab  = signal<ProfileTab>('overview');
  readonly editing    = signal(false);
  copied = false;
  readonly toggles    = signal<ToggleState>({
    discoverableByCoaches: true,
    showInPartnerSearch: true, publicProfile: false,
  });

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly profileData = toSignal<PlayerProfileDto | CoachProfileDto | null>(
    this.refresh$.pipe(
      switchMap(() => (this.user.role === 'Player'
        ? this.profileService.getMyPlayerProfile().pipe(catchError(() => of(null)))
        : this.profileService.getMyCoachProfile().pipe(catchError(() => of(null)))
      ) as Observable<PlayerProfileDto | CoachProfileDto | null>)
    )
  );

  readonly saveSuccess = signal(false);

  readonly progression = toSignal(
    this.progressionService.getMyProgression().pipe(catchError(() => of([] as CoachPlayerProgressionDto[]))),
    { initialValue: [] as CoachPlayerProgressionDto[] },
  );

  // Overview stats are computed client-side from the full completed-session list.
  // "Completed" is the domain source of truth for a session that actually happened.
  readonly completedSessions = toSignal(
    this.sessionRequestsService.getCompleted().pipe(catchError(() => of([] as CompletedSessionDto[]))),
    { initialValue: [] as CompletedSessionDto[] }
  );

  // Current calendar month, evaluated in the browser-local timezone (Europe/Skopje for the user).
  private readonly monthSessions = computed(() => {
    const now = new Date();
    return this.completedSessions().filter(s => {
      const d = new Date(s.proposedDateTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  });

  private sumHours(list: CompletedSessionDto[]): number {
    return list.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  }
  private countCoach(list: CompletedSessionDto[]): number {
    return list.filter(s => s.sessionType === 'CoachPlayer').length;
  }
  private countPlayer(list: CompletedSessionDto[]): number {
    return list.filter(s => s.sessionType === 'PlayerPlayer').length;
  }

  private coachSessions(list: CompletedSessionDto[]): CompletedSessionDto[] {
    return list.filter(s => s.sessionType === 'CoachPlayer');
  }

  // This month
  readonly hoursThisMonth         = computed(() => this.sumHours(this.monthSessions()));
  readonly sessionsThisMonth      = computed(() => this.monthSessions().length);
  readonly coachSessionsThisMonth = computed(() => this.countCoach(this.monthSessions()));
  readonly playerSessionsThisMonth = computed(() => this.countPlayer(this.monthSessions()));
  // Coach overview: hours/sessions from completed CoachPlayer sessions only.
  readonly coachHoursThisMonth    = computed(() => this.sumHours(this.coachSessions(this.monthSessions())));

  // All time
  readonly hoursAllTime          = computed(() => this.sumHours(this.completedSessions()));
  readonly sessionsAllTime       = computed(() => this.completedSessions().length);
  readonly coachSessionsAllTime  = computed(() => this.countCoach(this.completedSessions()));
  readonly playerSessionsAllTime = computed(() => this.countPlayer(this.completedSessions()));
  readonly coachHoursAllTime     = computed(() => this.sumHours(this.coachSessions(this.completedSessions())));

  /* ── Activity feed (paginated session history) ── */
  private static readonly ACTIVITY_PAGE_SIZE = 15;
  readonly activitySessions    = signal<CompletedSessionDto[]>([]);
  readonly activityLoading     = signal(false);
  readonly activityLoadingMore = signal(false);
  readonly activityHasMore     = signal(true);
  readonly activityFrom        = signal<string>('');
  readonly activityTo          = signal<string>('');
  readonly activityFiltered    = signal(false);
  private activityLoaded = false;
  private activityPage = 1;
  private activityGeneration = 0;
  private appliedFrom: string | null = null;
  private appliedTo: string | null = null;
  private readonly activityScrollListener = (): void => this.maybeLoadMoreActivity();

  readonly playerProfile = computed<PlayerProfileDto | null>(() =>
    this.user.role === 'Player' ? (this.profileData() as PlayerProfileDto ?? null) : null
  );
  readonly coachProfile = computed<CoachProfileDto | null>(() =>
    this.user.role === 'Coach' ? ((this.profileData() as unknown) as CoachProfileDto ?? null) : null
  );

  readonly initials = computed(() =>
    (this.user.firstName[0] ?? '') + (this.user.lastName[0] ?? '')
  );

  readonly topThree = computed(() => (this.progression() ?? []).slice(0, 3));

  readonly avatarRingOffset = computed(() => {
    const top = (this.progression() ?? [])[0];
    if (!top) return CIRC_LG;
    return CIRC_LG * (1 - this.fillPercent(top.totalHours, top.currentLevel));
  });

  readonly memberSince = computed(() => {
    const d = new Date(this.user.createdAt);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  readonly tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview',     label: 'Overview' },
    { id: 'tennis',       label: this.user.role === 'Player' ? 'Tennis profile' : 'Coaching profile' },
    { id: 'progression',  label: 'Progression' },
    { id: 'activity',     label: 'Activity' },
    { id: 'settings',     label: 'Settings' },
  ];

  readonly TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly CIRC_LG = CIRC_LG;
  readonly CIRC_SM = CIRC_SM;

  ngAfterViewInit(): void {
    window.addEventListener('scroll', this.activityScrollListener, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.activityScrollListener);
  }

  switchTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    // Lazily load the activity feed the first time the tab is opened.
    if (tab === 'activity' && !this.activityLoaded) {
      this.activityLoaded = true;
      this.loadActivityFirstPage();
    }
  }

  toggle(key: keyof ToggleState): void {
    this.toggles.update(t => ({ ...t, [key]: !t[key] }));
  }

  onSaved(updated: UserDto): void {
    this.authService.setUser(updated);
    this.editing.set(false);
    this.saveSuccess.set(true);
    this.refresh$.next();
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }

  shareProfile(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  /* ── Activity feed: loading, pagination, date filter ── */
  onActivityFromChange(e: Event): void {
    this.activityFrom.set((e.target as HTMLInputElement).value);
  }
  onActivityToChange(e: Event): void {
    this.activityTo.set((e.target as HTMLInputElement).value);
  }
  applyActivityFilter(): void {
    this.appliedFrom = this.activityFrom() || null;
    this.appliedTo = this.activityTo() || null;
    this.loadActivityFirstPage();
  }
  clearActivityFilter(): void {
    this.activityFrom.set('');
    this.activityTo.set('');
    this.appliedFrom = null;
    this.appliedTo = null;
    this.loadActivityFirstPage();
  }

  private loadActivityFirstPage(): void {
    const gen = ++this.activityGeneration;
    this.activityPage = 1;
    this.activitySessions.set([]);
    this.activityHasMore.set(true);
    this.activityLoading.set(true);
    this.activityFiltered.set(!!this.appliedFrom || !!this.appliedTo);
    this.fetchActivityPage(gen);
  }

  private fetchActivityPage(gen: number): void {
    this.sessionRequestsService.getActivity({
      page: this.activityPage,
      pageSize: ProfileComponent.ACTIVITY_PAGE_SIZE,
      from: this.appliedFrom,
      to: this.appliedTo,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: results => {
        if (gen !== this.activityGeneration) return;
        if (this.activityPage === 1) {
          this.activitySessions.set(results);
        } else {
          this.activitySessions.update(prev => [...prev, ...results]);
        }
        if (results.length < ProfileComponent.ACTIVITY_PAGE_SIZE) this.activityHasMore.set(false);
        this.activityLoading.set(false);
        this.activityLoadingMore.set(false);
        // Auto-fill if the first page didn't reach the bottom of the viewport.
        setTimeout(() => this.maybeLoadMoreActivity());
      },
      error: () => {
        if (gen !== this.activityGeneration) return;
        this.activityLoading.set(false);
        this.activityLoadingMore.set(false);
      },
    });
  }

  private maybeLoadMoreActivity(): void {
    if (this.activeTab() !== 'activity') return;
    if (!this.activityHasMore() || this.activityLoading() || this.activityLoadingMore()) return;
    const sentinel = this.activitySentinelRef?.nativeElement;
    if (!sentinel) return;
    if (sentinel.getBoundingClientRect().top <= window.innerHeight + 300) {
      this.activityPage++;
      this.activityLoadingMore.set(true);
      this.fetchActivityPage(this.activityGeneration);
    }
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  formatActivityDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  /* ── Ring geometry ── */
  fillPercent(totalHours: number, level: number): number {
    if (level === 0) return Math.min(totalHours / 100, 1);
    if (level === 1) return Math.min((totalHours - 100) / 75, 1);
    if (level === 2) return Math.min((totalHours - 175) / 125, 1);
    return 1;
  }
  smallRingOffset(prog: CoachPlayerProgressionDto): number {
    return CIRC_SM * (1 - this.fillPercent(prog.totalHours, prog.currentLevel));
  }

  /* ── Skill bar ── */
  skillFillPct(level: number): number {
    return ((level - 1) / 9) * 100;
  }

  /* ── Tier helpers ── */
  tierLabel(level: number, discount: number): string {
    if (level === 0) return 'No tier yet';
    if (level === 1) return `Bronze −${discount}%`;
    if (level === 2) return `Silver −${discount}%`;
    return `Gold −${discount}%`;
  }
  hoursToNext(prog: CoachPlayerProgressionDto): string {
    const h = prog.totalHours;
    if (prog.currentLevel === 0) return `${Math.max(0, 100 - h)}h to Bronze`;
    if (prog.currentLevel === 1) return `${Math.max(0, 175 - h)}h to Silver`;
    if (prog.currentLevel === 2) return `${Math.max(0, 300 - h)}h to Gold`;
    return 'Max tier reached';
  }
  progInitials(prog: CoachPlayerProgressionDto): string {
    return (prog.counterpartFirstName[0] ?? '') + (prog.counterpartLastName[0] ?? '');
  }

  /* ── Skill level labels ── */
  skillName(level: number): string { return SKILL_NAMES[level] ?? ''; }
  skillDesc(level: number): string { return SKILL_DESCS[level] ?? ''; }

  /* ── Date helpers ── */
  formatDob(dob: string): string {
    const d = new Date(dob + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  computeAge(dob: string): number {
    const birth = new Date(dob + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  formatRate(n: number): string { return Math.round(n).toLocaleString('en'); }

  // Clean hour display for stat tiles: "39" or "39.5" (the "h" suffix is added in the template).
  // Session durations are multiples of 30 min, so totals land on whole/half hours.
  hoursDisplay(h: number): string {
    const rounded = Math.round(h * 2) / 2;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  }

  /* ── Enum label helpers ── */
  handLabel(h: string): string {
    return h === 'Left' ? 'Left' : 'Right';
  }
  backhandLabel(b: string): string {
    return b === 'OneHanded' ? 'One-handed' : 'Two-handed';
  }
  freqLabel(f: TrainingFrequencyPerDay): string {
    const map: Record<TrainingFrequencyPerDay, string> = {
      OncePerDay: 'Once per day', TwicePerDay: 'Twice per day', Flexible: 'Flexible',
    };
    return map[f] ?? f;
  }
  surfaceLabel(s: Surface): string {
    const map: Record<Surface, string> = {
      Clay: 'Clay', HardCourt: 'Hard Court', Grass: 'Grass', NoPreference: 'No preference',
    };
    return map[s] ?? s;
  }
  coachingStyleLabel(s: CoachingStyle): string {
    const map: Record<CoachingStyle, string> = {
      Demanding: 'Demanding', Balanced: 'Balanced', Relaxed: 'Relaxed',
    };
    return map[s] ?? s;
  }
  goalLabel(g: MainGoal): string {
    const map: Record<MainGoal, string> = {
      ImproveTechnique: 'Improve technique', ImproveFitness: 'Improve fitness',
      PrepareForTournaments: 'Prepare for tournaments', FindHittingPartners: 'Find hitting partners',
      ReturnToTennis: 'Return to tennis', TrainRecreationally: 'Train recreationally',
      BecomeProfessional: 'Become professional',
      ImproveServe: 'Improve serve', ImproveFootwork: 'Improve footwork',
      ImproveConsistency: 'Improve consistency', ImproveMatchPlay: 'Improve match play',
      ReduceInjuryRisk: 'Reduce injury risk', PlayCompetitivelyAgain: 'Play competitively again',
      LearnTennis: 'Learn tennis', ImproveMentalGame: 'Improve mental game',
      FindSocialPlaying: 'Find social playing',
    };
    return map[g] ?? g;
  }
  specialtyLabel(s: Specialty): string {
    const map: Record<Specialty, string> = {
      Technique: 'Technique', Serve: 'Serve', Forehand: 'Forehand', Backhand: 'Backhand',
      Footwork: 'Footwork', Fitness: 'Fitness', MatchStrategy: 'Match Strategy',
      TournamentPreparation: 'Tournament Prep', JuniorDevelopment: 'Junior Development',
      BeginnerCoaching: 'Beginner Coaching',
    };
    return map[s] ?? s;
  }
  skillGroupLabel(g: SkillLevelGroup): string {
    const map: Record<SkillLevelGroup, string> = {
      Group1To3: 'Levels 1–3', Group4To6: 'Levels 4–6', Group7To8: 'Levels 7–8', Group9To10: 'Levels 9–10',
    };
    return map[g] ?? g;
  }
  ageGroupLabel(g: AgeGroup): string {
    const map: Record<AgeGroup, string> = {
      Children6To12: 'Children (6–12)', Juniors13To18: 'Juniors (13–18)',
      Adults18Plus: 'Adults (18+)', Seniors35Plus: 'Seniors (35+)',
    };
    return map[g] ?? g;
  }
}
