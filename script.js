// Initialize WebSocket connection
const room = new WebsimSocket();

// Initialize state
let schools = [];
let ratings = {};

// Subscribe to schools collection
room.collection('school').subscribe(function (updatedSchools) {
  schools = updatedSchools;
  displaySchools(schools);
});

// Subscribe to ratings collection
room.collection('rating').subscribe(function (updatedRatings) {
  ratings = updatedRatings.reduce((acc, rating) => {
    acc[rating.schoolId] = rating.data;
    return acc;
  }, {});
  displaySchools(schools);
});

// Initialize school rating
const initializeSchoolRating = async (schoolId) => {
  if (!ratings[schoolId]) {
    const rating = await room.collection('rating').create({
      schoolId,
      data: {
        thumbsUp: 0,
        thumbsDown: 0,
        stars: {
          total: 0,
          count: 0
        },
        userVotes: {}
      }
    });
    ratings[schoolId] = rating.data;
  }
  return ratings[schoolId];
};

// Handle thumb votes
const handleThumbVote = async (schoolId, isUp) => {
  const rating = ratings[schoolId];
  if (!rating) return;

  const clientId = room.party.client.id;
  const userVotes = rating.userVotes;
  const previousVote = userVotes[clientId]?.thumb;

  if (previousVote === isUp) {
    if (isUp) rating.thumbsUp--;
    else rating.thumbsDown--;
    delete userVotes[clientId].thumb;
  } else {
    if (previousVote === true) rating.thumbsUp--;
    else if (previousVote === false) rating.thumbsDown--;
    
    if (isUp) rating.thumbsUp++;
    else rating.thumbsDown++;
    
    if (!userVotes[clientId]) userVotes[clientId] = {};
    userVotes[clientId].thumb = isUp;
  }

  // Update rating in database
  const ratingRecord = await room.collection('rating')
    .filter({ schoolId: schoolId })
    .getList();
  if (ratingRecord && ratingRecord[0]) {
    await room.collection('rating').update(ratingRecord[0].id, {
      data: rating
    });
  }
};

// Handle star ratings
const handleStarRating = async (schoolId, rating) => {
  const schoolRating = ratings[schoolId];
  if (!schoolRating) return;

  const clientId = room.party.client.id;
  const userVotes = schoolRating.userVotes;
  const previousRating = userVotes[clientId]?.stars;

  if (previousRating) {
    schoolRating.stars.total -= previousRating;
    schoolRating.stars.count--;
  }

  schoolRating.stars.total += rating;
  schoolRating.stars.count++;

  if (!userVotes[clientId]) userVotes[clientId] = {};
  userVotes[clientId].stars = rating;

  // Update rating in database
  const ratingRecord = await room.collection('rating')
    .filter({ schoolId: schoolId })
    .getList();
  if (ratingRecord && ratingRecord[0]) {
    await room.collection('rating').update(ratingRecord[0].id, {
      data: schoolRating
    });
  }
};

// Display schools
const displaySchools = (schoolsToDisplay) => {
  const schoolsList = document.getElementById('schoolsList');
  if (!schoolsList) return;
  
  schoolsList.innerHTML = '';
  
  schoolsToDisplay.forEach(async school => {
    await initializeSchoolRating(school.id);
    const schoolRating = ratings[school.id];
    const userVotes = schoolRating?.userVotes[room.party.client.id] || {};
    
    const averageStars = schoolRating?.stars.count > 0 
      ? (schoolRating.stars.total / schoolRating.stars.count).toFixed(1)
      : 0;

    const levelInfo = [];
    if (school.levels.infantil.active) {
      levelInfo.push(`<div><span class="badge bg-secondary">Educação Infantil</span> R$ ${school.levels.infantil.price.toFixed(2)}</div>`);
    }
    if (school.levels.fundamental1.active) {
      levelInfo.push(`<div><span class="badge bg-secondary">Fundamental I</span> R$ ${school.levels.fundamental1.price.toFixed(2)}</div>`);
    }
    if (school.levels.fundamental2.active) {
      levelInfo.push(`<div><span class="badge bg-secondary">Fundamental II</span> R$ ${school.levels.fundamental2.price.toFixed(2)}</div>`);
    }
    if (school.levels.medio.active) {
      levelInfo.push(`<div><span class="badge bg-secondary">Ensino Médio</span> R$ ${school.levels.medio.price.toFixed(2)}</div>`);
    }
    
    const schoolCard = document.createElement('div');
    schoolCard.className = 'col-md-6 mb-4';
    schoolCard.innerHTML = `
      <div class="card school-card">
        <div class="card-body">
          <h5 class="card-title">${school.name}</h5>
          <p class="card-text">
            <strong>Cidade:</strong> ${school.city === 'barueri' ? 'Barueri' : 'Santana de Parnaíba'}<br>
            <strong>Endereço:</strong> ${school.address}<br>
            <strong>Telefone:</strong> ${school.phone}<br>
            <strong>Horário:</strong> ${school.hours}<br>
            <strong>Níveis de Ensino e Mensalidades:</strong><br>
            ${levelInfo.join('')}
          </p>
          ${school.info ? `<p class="card-text"><small class="text-muted">${school.info}</small></p>` : ''}
          <div class="rating-section">
            <div class="thumbs-section">
              <button class="thumb-button ${userVotes.thumb === true ? 'active' : ''}" onclick="handleThumbVote(${school.id}, true)">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="${userVotes.thumb === true ? '#0d6efd' : '#6c757d'}" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                </svg>
                <span class="ms-1">${schoolRating.thumbsUp}</span>
              </button>
              <button class="thumb-button ${userVotes.thumb === false ? 'active' : ''}" onclick="handleThumbVote(${school.id}, false)">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="${userVotes.thumb === false ? '#0d6efd' : '#6c757d'}" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                </svg>
                <span class="ms-1">${schoolRating.thumbsDown}</span>
              </button>
            </div>
            <div class="stars-section">
              <div class="star-rating">
                ${[1, 2, 3, 4, 5].map(star => `
                  <svg class="star ${(userVotes.stars || 0) >= star ? 'active' : ''}" 
                       width="24" height="24" viewBox="0 0 24 24"
                       onclick="handleStarRating(${school.id}, ${star})">
                    <path fill="${(userVotes.stars || 0) >= star ? '#ffc107' : '#6c757d'}" 
                          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                  </svg>
                `).join('')}
              </div>
              <span class="rating-count">${averageStars} (${schoolRating.stars.count})</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    schoolsList.appendChild(schoolCard);
  });
};

// Document ready handler
document.addEventListener('DOMContentLoaded', () => {
  // Add school form handler
  const addSchoolForm = document.getElementById('addSchoolForm');
  if (addSchoolForm) {
    addSchoolForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get selected periods
      const periods = ['Matutino', 'Vespertino', 'Integral']
        .filter(period => {
          const periodElement = document.getElementById(`period${period}`);
          return periodElement && periodElement.checked;
        })
        .join(', ');

      const newSchool = {
        id: Date.now(),
        name: document.getElementById('schoolName')?.value || '',
        city: document.getElementById('schoolCity')?.value || '',
        address: document.getElementById('schoolAddress')?.value || '',
        phone: document.getElementById('schoolPhone')?.value || '',
        hours: periods,
        levels: {
          infantil: {
            active: document.getElementById('infantil')?.checked || false,
            price: document.getElementById('infantil')?.checked ? 
              parseFloat(document.getElementById('infantilPrice')?.value) || 0 : null
          },
          fundamental1: {
            active: document.getElementById('fundamental1')?.checked || false,
            price: document.getElementById('fundamental1')?.checked ? 
              parseFloat(document.getElementById('fundamental1Price')?.value) || 0 : null
          },
          fundamental2: {
            active: document.getElementById('fundamental2')?.checked || false,
            price: document.getElementById('fundamental2')?.checked ? 
              parseFloat(document.getElementById('fundamental2Price')?.value) || 0 : null
          },
          medio: {
            active: document.getElementById('medio')?.checked || false,
            price: document.getElementById('medio')?.checked ? 
              parseFloat(document.getElementById('medioPrice')?.value) || 0 : null
          }
        },
        info: document.getElementById('schoolInfo')?.value || ''
      };

      // Create school in database
      await room.collection('school').create(newSchool);
      
      // Close modal and reset form
      const modal = bootstrap.Modal.getInstance(document.getElementById('addSchoolModal'));
      if (modal) {
        modal.hide();
      }
      addSchoolForm.reset();
    });
  }

  // Filtros
  const applyFilters = () => {
    let filteredSchools = [...schools];
    
    const nameFilter = document.getElementById('nameFilter')?.value.toLowerCase() || '';
    const cityFilter = document.getElementById('cityFilter')?.value || '';
    const priceFilter = document.getElementById('priceFilter')?.value || '';
    
    // Get selected periods
    const selectedPeriods = Array.from(document.querySelectorAll('.periodFilter:checked'))
      .map(checkbox => checkbox.value);
    
    // Get selected levels
    const selectedLevels = Array.from(document.querySelectorAll('.levelFilter:checked'))
      .map(checkbox => checkbox.value);
    
    // Filter by name
    if (nameFilter) {
      filteredSchools = filteredSchools.filter(school => 
        school.name.toLowerCase().includes(nameFilter)
      );
    }
    
    // Filter by city
    if (cityFilter) {
      filteredSchools = filteredSchools.filter(school => school.city === cityFilter);
    }
    
    // Filter by periods
    if (selectedPeriods.length > 0) {
      filteredSchools = filteredSchools.filter(school => {
        const schoolPeriods = school.hours.split(', ');
        return selectedPeriods.some(period => schoolPeriods.includes(period));
      });
    }
    
    // Filter by levels
    if (selectedLevels.length > 0) {
      filteredSchools = filteredSchools.filter(school => 
        selectedLevels.some(level => school.levels[level].active)
      );
    }
    
    // Filter by price
    if (priceFilter) {
      const [min, max] = priceFilter.split('-').map(Number);
      filteredSchools = filteredSchools.filter(school => {
        const prices = Object.values(school.levels)
          .filter(level => level.active)
          .map(level => level.price);
        
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        if (max) {
          return averagePrice >= min && averagePrice <= max;
        } else {
          return averagePrice >= min;
        }
      });
    }
    
    displaySchools(filteredSchools);
  };

  // Eventos dos filtros
  const nameFilter = document.getElementById('nameFilter');
  const cityFilter = document.getElementById('cityFilter');
  const priceFilter = document.getElementById('priceFilter');

  if (nameFilter) nameFilter.addEventListener('input', applyFilters);
  if (cityFilter) cityFilter.addEventListener('change', applyFilters);
  if (priceFilter) priceFilter.addEventListener('change', applyFilters);

  document.querySelectorAll('.periodFilter').forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', applyFilters);
    }
  });

  document.querySelectorAll('.levelFilter').forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', applyFilters);
    }
  });

  // Habilitar/desabilitar campos de preço baseado nos checkboxes
  document.querySelectorAll('.form-check-input').forEach(checkbox => {
    if (checkbox.id.startsWith('period')) return; // Ignore period checkboxes
    const priceInput = document.getElementById(`${checkbox.id}Price`);
    if (priceInput && checkbox) {
      checkbox.addEventListener('change', (e) => {
        priceInput.disabled = !e.target.checked;
        if (!e.target.checked) {
          priceInput.value = '';
        }
      });
    }
  });
});
