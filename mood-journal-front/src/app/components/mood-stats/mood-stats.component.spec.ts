import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MoodStatsComponent } from './mood-stats.component';

describe('MoodStatsComponent', () => {
  let component: MoodStatsComponent;
  let fixture: ComponentFixture<MoodStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoodStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MoodStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});