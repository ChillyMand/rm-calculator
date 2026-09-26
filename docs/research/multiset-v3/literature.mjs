// Group summaries, NOT participant records or simulated observations.
// Richmond second sets are approximate figure readings, not printed numbers.
// See EVIDENCE.md for provenance, protocol differences and permitted use.
export const studies = [
  {
    id: 'willardson2006', role: 'calibration', n: 16, relativeLoad: 0.8,
    url: 'https://doi.org/10.1519/R-17735.1', locator: 'Table 3, printed page 398',
    conditions: [
      { rest: 1, reps: [9.38, 3.31, 2.06, 1.69, 1.63] },
      { rest: 2, reps: [9.13, 5.19, 3.38, 2.81, 2.56] },
      { rest: 3, reps: [9.13, 5.94, 4.69, 3.81, 3.50] },
    ],
  },
  {
    id: 'richmond2004', role: 'calibration', n: 28, relativeLoad: 0.75,
    url: 'https://doi.org/10.1519/14833.1', locator: 'Figure 1, printed page 847',
    laterSetsDigitized: true, readingToleranceReps: 0.2,
    conditions: [
      { rest: 1, reps: [11.9, 5.5] },
      { rest: 3, reps: [11.5, 8.5] },
      { rest: 5, reps: [11.5, 9.8] },
    ],
  },
  {
    id: 'yoon2023', role: 'out_of_domain_stress', n: 8, relativeLoad: 0.65,
    url: 'https://doi.org/10.3390/app13137850', locator: 'Table 3, PDF page 6',
    conditions: [
      { rest: 0.5, reps: [20.0, 7.0, 4.6, 3.8, 3.2, 3.1, 3.1] },
      { rest: 1, reps: [20.2, 9.8, 6.8, 5.3, 4.5, 4.3, 4.3] },
      { rest: 2, reps: [20.5, 13.2, 9.8, 8.8, 8.0, 7.4, 7.3] },
      { rest: 3, reps: [20.4, 14.9, 11.5, 10.1, 8.3, 8.4, 7.5] },
      { rest: 4, reps: [20.4, 17.0, 14.1, 12.1, 11.8, 11.0, 10.1] },
      { rest: 5, reps: [20.6, 18.3, 15.8, 13.8, 12.9, 12.0, 10.8] },
    ],
  },
];
