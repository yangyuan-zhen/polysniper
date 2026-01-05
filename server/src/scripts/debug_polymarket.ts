import axios from 'axios';

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

async function debugPolymarket() {
  try {
    const targetSlug = 'nba-atl-tor-2026-01-05';
    console.log(`Attempting to fetch specific event by slug: ${targetSlug}`);
    
    try {
      const slugResponse = await axios.get(`${GAMMA_API_URL}/events`, {
        params: { slug: targetSlug }
      });
      if (slugResponse.data && slugResponse.data.length > 0) {
        console.log('*** FOUND BY SLUG ***');
        const e = slugResponse.data[0];
        console.log(`Title: ${e.title}`);
        console.log(`ID: ${e.id}`);
        console.log(`Series ID: ${e.series_id}`);
        console.log(`Active: ${e.active}, Closed: ${e.closed}`);
        return;
      } else {
        console.log('Not found by slug directly.');
      }
    } catch (err: any) {
      console.log('Error fetching by slug:', err.message);
    }

    console.log('Fetching ALL events (no active filter, limit 1000)...');
    const response = await axios.get(`${GAMMA_API_URL}/events`, {
      params: { 
        limit: 1000, 
        // active: true, // REMOVED ACTIVE FILTER
        closed: false,
        offset: 0
      }
    });

    const events = response.data;
    console.log(`Fetched ${events.length} events.`);

    const targetEvents = events.filter((e: any) => {
      const slug = (e.slug || '').toLowerCase();
      const title = (e.title || '').toLowerCase();
      return slug.includes('atl-tor') || title.includes('raptors');
    });

    console.log(`Found ${targetEvents.length} potential matches.`);

    targetEvents.forEach((e: any) => {
      console.log('---------------------------------------------------');
      console.log(`Title: ${e.title}`);
      console.log(`Slug: ${e.slug}`);
      console.log(`ID: ${e.id}`);
      console.log(`Series ID: ${e.series_id}`);
      console.log(`Start Date: ${e.startDate}`);
      console.log(`Active: ${e.active}, Closed: ${e.closed}`);
    });

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

debugPolymarket();
