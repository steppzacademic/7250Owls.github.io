// CONFIGURATION
const TBA_API_KEY = 'Imp1K3Z8VHhPqSpujx5KjiR1nJhTGCL5RA6WyhAqFV1RyRVcwfxQFwezyEusYQVU';
const TEAM_KEY = 'frc7250';
const YEAR = new Date().getFullYear(); 

async function fetchNextMatch() {
    try {
        // Fetch all matches for the team in the current year
        const response = await fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/matches/${YEAR}`, {
            headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
        });

        if (!response.ok) throw new Error("Failed to fetch from TBA. Check your API key.");
        
        const matches = await response.json();
        const now = Math.floor(Date.now() / 1000); // Current time in UNIX seconds
        
        // Filter for matches that haven't happened yet (using predicted time if available, otherwise scheduled time)
        const upcomingMatches = matches.filter(m => {
            const matchTime = m.predicted_time || m.time;
            return matchTime !== null && matchTime > now;
        });

        // Sort chronologically to find the immediate next match
        upcomingMatches.sort((a, b) => (a.predicted_time || a.time) - (b.predicted_time || b.time));

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('match-data').style.display = 'block';

        if (upcomingMatches.length > 0) {
            startCountdown(upcomingMatches[0]);
        } else {
            document.getElementById('match-info').innerText = "No upcoming matches found for the current event.";
            document.getElementById('countdown-display').innerText = "STANDBY";
        }

    } catch (error) {
        console.error(error);
        document.getElementById('loading-state').innerText = "Error connecting to The Blue Alliance.";
    }
}

function startCountdown(match) {
    // Determine Alliance (Red or Blue)
    let alliance = 'UNKNOWN';
    let allianceClass = '';
    
    if (match.alliances.red.team_keys.includes(TEAM_KEY)) {
        alliance = 'RED ALLIANCE';
        allianceClass = 'alliance-red';
    } else if (match.alliances.blue.team_keys.includes(TEAM_KEY)) {
        alliance = 'BLUE ALLIANCE';
        allianceClass = 'alliance-blue';
    }

    // Format match name (e.g., "qm12" -> "Quals 12", "sf1m1" -> "Semifinal 1")
    let matchType = match.comp_level.toUpperCase();
    if(matchType === 'QM') matchType = 'Qualifications';
    const matchName = `${matchType} Match ${match.match_number}`;

    // Update DOM with Match info
    document.getElementById('match-info').innerHTML = 
        `${matchName} | <span class="${allianceClass}">${alliance}</span>`;

    // Use predicted_time if the event is running ahead/behind, fallback to scheduled time
    const targetTimeUnix = match.predicted_time || match.time;
    const targetDate = new Date(targetTimeUnix * 1000).getTime();

    // Setup Interval for Countdown
    const timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            document.getElementById('countdown-display').innerText = "MATCH LIVE";
            return;
        }

        // Time calculations
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Format with leading zeros for neatness
        const formatNum = (num) => String(num).padStart(2, '0');

        let timeString = '';
        if (days > 0) timeString += `${days}d `;
        timeString += `${formatNum(hours)}h ${formatNum(minutes)}m ${formatNum(seconds)}s`;

        document.getElementById('countdown-display').innerText = timeString;
    }, 1000);
}

// Initialize
fetchNextMatch();