import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MoodAnalyticsComponent } from './mood-analytics.component';

describe('MoodAnalyticsComponent', () => {
  let component: MoodAnalyticsComponent;
  let fixture: ComponentFixture<MoodAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoodAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MoodAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
