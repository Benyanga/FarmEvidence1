import { downloadFarmerSeasonalReport } from './pdf';

function makeFixture() {
  return {
    farmerName: 'Tuzamurane Youth Cooperative',
    system: 'CA',
    crop: 'Bean',
    seasonLabel: 'Season B 2026',
    location: 'Huye, Southern Province',
    harvestKg: 16.7,
    revenue: 20040,
    cost: 12613,
    profit: 7427,
    profitPerHa: 6189167,
    bcr: 1.59,
    costPerKg: 755,
    breakEvenYield: 10.5,
    inputCosts: [
      { inputName: 'Bean seed', totalCost: 3000, date: '2026-02-01' },
      { inputName: 'NPK fertilizer', totalCost: 4000, date: '2026-02-10' }
    ],
    laborCosts: [{ activity: 'Weeding', laborCost: 5613, date: '2026-03-01' }],
    priorSeasons: [{ season: 3, farmingSystem: 'CA', profit: 5000 }],
    cooperativeAvgProfit: null
  };
}

describe('downloadFarmerSeasonalReport end-to-end', () => {
  it('renders the full Farmer Mode report to a real PDF, with PT Serif embedded and no watermark', async () => {
    const base64 = await downloadFarmerSeasonalReport(makeFixture());
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(5000);

    const text = Buffer.from(base64, 'base64').toString('latin1');
    expect(text).toMatch(/PT ?Serif/i);
    expect(text).not.toMatch(/Roboto/);
    // pdfmake's watermark feature stamps a distinctive /Watermark structure into the PDF — confirm it's absent.
    expect(text).not.toContain('/Watermark');
  });
});
