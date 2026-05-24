import { logger } from '../config/logger.js';

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

const extractPercentile = (record, metricKey) => {
  const metric = record?.metrics?.[metricKey];
  return metric?.percentiles?.p75 ?? null;
};

const extractDistribution = (record, metricKey) => {
  return record?.metrics?.[metricKey]?.histogram ?? [];
};

export const getCruxFieldData = async (url) => {
  const apiKey = process.env.CRUX_API_KEY;

  if (!apiKey) {
    return {
      available: false,
      provider: 'CrUX',
      reason: 'CRUX_API_KEY not configured'
    };
  }

  try {
    const response = await fetch(`${CRUX_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formFactor: 'PHONE'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CrUX API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const record = data.record;

    return {
      available: true,
      provider: 'CrUX',
      collectionPeriod: record?.collectionPeriod || null,
      formFactor: 'PHONE',
      metrics: {
        largestContentfulPaint: extractPercentile(record, 'largest_contentful_paint'),
        cumulativeLayoutShift: extractPercentile(record, 'cumulative_layout_shift'),
        interactionToNextPaint: extractPercentile(record, 'interaction_to_next_paint'),
        firstContentfulPaint: extractPercentile(record, 'first_contentful_paint'),
        experimentalTimeToFirstByte: extractPercentile(record, 'experimental_time_to_first_byte')
      },
      distributions: {
        largestContentfulPaint: extractDistribution(record, 'largest_contentful_paint'),
        cumulativeLayoutShift: extractDistribution(record, 'cumulative_layout_shift'),
        interactionToNextPaint: extractDistribution(record, 'interaction_to_next_paint')
      }
    };
  } catch (error) {
    logger.warn(`CrUX lookup failed for ${url}: ${error.message}`);
    return {
      available: false,
      provider: 'CrUX',
      reason: error.message
    };
  }
};
