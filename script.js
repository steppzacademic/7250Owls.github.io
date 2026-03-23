const TBA_API_KEY = 'Imp1K3Z8VHhPqSpujx5KjiR1nJhTGCL5RA6WyhAqFV1RyRVcwfxQFwezyEusYQVU';
const TEAM_KEY = 'frc7250';
const CURRENT_YEAR = new Date().getFullYear();
const YEARS_TO_SHOW = CURRENT_YEAR - 2018+1;
let statsCache = {};

function toggleMatches(btn) {
    const container = btn.closest('.report-section').querySelector('.matches-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = '▲';
    } else {
        container.style.display = 'none';
        btn.textContent = '▼';
    }
}

function initMarquee() {
    const content = document.getElementById('marquee-content');
    if (!content) return;
    const style = getComputedStyle(content);
    const gap = parseInt(style.gap) || 0;
    const originalHTML = content.innerHTML;
    content.innerHTML += originalHTML;
    window.addEventListener('load', () => {
        const singleSetWidth = (content.scrollWidth + gap) / 2;
        content.style.setProperty('--scroll-distance', `-${singleSetWidth}px`);
        content.style.animation = "navScroll 30s linear infinite";
    });
}

initMarquee();

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const activeLink = Array.from(navItems).find(link => link.getAttribute('onclick').includes(sectionId));
    if (activeLink) activeLink.classList.add('active');
    if (sectionId === 'stats') { fetchTeamStats(); }
    window.scrollTo(0, 0); // Reset scroll for iPhone
}

function switchYear(year) {
    const tabsContainer = document.getElementById('year-tabs');
    const tabs = tabsContainer.querySelectorAll('.year-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('stats-container');
    if (statsCache[year]) {
        container.innerHTML = statsCache[year];
    } else {
        container.innerHTML = '<p>LOADING YEAR DATA...</p>';
    }
}

async function fetchTeamStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = '<p>RECALLING MISSION ARCHIVES...</p>';

    try {
        // Create tabs for years
        const yearsArray = Array.from({length: YEARS_TO_SHOW}, (_, i) => CURRENT_YEAR - i);
        const tabsHTML = yearsArray.map((year, idx) => 
            `<button class="year-tab${idx === 0 ? ' active' : ''}" onclick="switchYear(${year})">${year}</button>`
        ).join('');
        document.getElementById('year-tabs').innerHTML = tabsHTML;

        // Fetch data for all years
        for (const year of yearsArray) {
            if (statsCache[year]) continue; // Skip if already cached
            
            const eventsRes = await fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${year}`, {
                headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
            });
            const events = await eventsRes.json();
            events.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            let html = '';
            const today = new Date();

            for (const event of events) {
                const eventStartDate = new Date(event.start_date);
                if (eventStartDate > today) {
                    html += `
                        <div class="stats-card">
                            <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                            <p style="margin-top:10px;">📍 ${event.city}, ${event.state_prov}</p>
                            <p>📅 ${event.start_date} [UPCOMING]</p>
                            <div class="external-links">
                                <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                                <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                            </div>
                        </div>`;
                    continue;
                }

                const [statusRes, matchesRes, awardsRes] = await Promise.all([
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/status`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/matches`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/awards`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } })
                ]);

                const status = await statusRes.json();
                const matches = await matchesRes.json();
                const awards = await awardsRes.json();

                const teamMatches = matches.filter(m => m.alliances.blue.team_keys.includes(TEAM_KEY) || m.alliances.red.team_keys.includes(TEAM_KEY));
                const sortedMatches = teamMatches.sort((a, b) => a.time - b.time);
                
                const qualMatches = sortedMatches.filter(m => m.comp_level === 'qm').map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const alliance = isBlue ? 'BLUE' : 'RED';
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                    const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                    return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">Q${m.match_number}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
                }).join('');
                
                const playoffMatches = sortedMatches.filter(m => m.comp_level !== 'qm').map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const alliance = isBlue ? 'BLUE' : 'RED';
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                    let level = m.comp_level.toUpperCase();
                    let displayNum = `${m.set_number}-${m.match_number}`;
                    const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                    return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">${level}${displayNum}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
                }).join('');

                let finish = "Qualifications";
                let playoffRecord = "0W-0L";
                if (status?.playoff) {
                    const wins = status.playoff.record?.wins || 0;
                    const losses = status.playoff.record?.losses || 0;
                    playoffRecord = `${wins}W-${losses}L`;
                    if (status.playoff.status === 'won') finish = "Event Winners";
                    else if (status.playoff.level === 'f') finish = "Finalists";
                    else if (status.playoff.level === 'sf') finish = "Semifinalists";
                    else if (status.playoff.level === 'qf') finish = "Quarterfinalists";
                }

                const awardTags = awards.map(a => `<div class="award-tag">🏆 ${a.name}</div>`).join('');

                html += `
                    <div class="stats-card">
                        <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                        <div class="report-grid">
                            <div class="report-section">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h4>QUALIFICATIONS</h4>
                                    ${qualMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                                </div>
                                <p>Rank: <strong>${status?.qual?.ranking?.rank || 'N/A'}</strong></p>
                                <p>Record: <strong>${status?.qual?.ranking?.record?.wins || 0}W-${status?.qual?.ranking?.record?.losses || 0}L</strong></p>
                                ${qualMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${qualMatches}</div></div>` : ''}
                            </div>
                            <div class="report-section">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h4>PLAYOFFS</h4>
                                    ${playoffMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                                </div>
                                <p>Finish: <strong>${finish}</strong></p>
                                <p>Record: <strong>${playoffRecord}</strong></p>
                                ${playoffMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${playoffMatches}</div></div>` : ''}
                            </div>
                        </div>
                        <div class="awards-container">${awardTags}</div>
                        <div class="external-links">
                            <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                            <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                        </div>
                    </div>`;
            }
            statsCache[year] = html;
        }
        
        // Display current year data
        container.innerHTML = statsCache[CURRENT_YEAR];
    } catch (err) {
        container.innerHTML = '<p style="color:red">CONNECTION ERROR</p>';
    }
}

initMarquee();