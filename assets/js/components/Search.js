document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let searchData;
  let fuse;

  // Fetch the search index
  fetch('/index.json')
    .then(response => response.json())
    .then(data => {
      searchData = data;
      
      // Initialize Fuse with configuration options
      fuse = new Fuse(searchData, {
        keys: [
          { name: 'title', weight: 1.0 },
          { name: 'program_type', weight: 0.8 },
          { name: 'singers', weight: 0.7 },
          { name: 'players', weight: 0.7 },
          { name: 'composers', weight: 0.7 },
          { name: 'poets', weight: 0.7 },
          { name: 'announcers', weight: 0.7 },
          { name: 'dastgah', weight: 0.6 },
          { name: 'content', weight: 0.5 }
        ],
        includeScore: true,
        includeMatches: true, // This is crucial for highlighting
        threshold: 0.1, // 0 will make it exact match
        ignoreLocation: true,
        //minMatchCharLength: 2, // Only match terms with at least 2 characters
        useExtendedSearch: true, // For more exact matching
        findAllMatches: false,
        tokenize: true,           // Break the text into tokens (words)
        matchAllTokens: false,    // Don't require matching all tokens
        minMatchCharLength: 2     // Minimum character length for a match
        //distance: 0 // Makes matching more strict
      });
    });

  // Handle search input
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (!query) {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }
    
    if (fuse) {
      const results = fuse.search(query).slice(0, 10); // Limit to 10 results
      
      if (results.length > 0) {

        // First, get the search query from the input field
        const query = document.getElementById('search-input').value.trim();
        searchResults.innerHTML = results.map(result => {
          const item = result.item;

          // Get the matches from Fuse.js
          const matches = result.matches || [];

          // Create highlighted content snippets for each match
          let highlightedSnippets = [];

          matches.forEach(match => {
            const key = match.key;
            let displayKey = key;

            // Create user-friendly field names in Persian
            switch(key) {
              case 'title': displayKey = 'عنوان'; break;
              case 'program_type': displayKey = 'نوع برنامه'; break;
              case 'program_number': displayKey = 'شماره برنامه'; break;
              case 'dastgah': displayKey = 'دستگاه'; break;
              case 'singers': displayKey = 'خواننده'; break;
              case 'players': displayKey = 'نوازنده'; break;
              case 'announcers': displayKey = 'گوینده'; break;
              case 'composers': displayKey = 'آهنگساز'; break;
              case 'poets': displayKey = 'شاعر'; break;
              case 'content': displayKey = 'محتوا'; break;
            }

            // Handle different data types
            if (match.value !== undefined) {
              if (Array.isArray(match.value)) {
                // For array fields like singers, players, etc.
                highlightedSnippets.push(`<div class="match-snippet"><strong>${displayKey}:</strong> ${match.value.join('، ')}</div>`);
              } else {
                // For text fields
                let snippet = String(match.value);

                // Get context around the matches in the content
                if (key === 'content' && snippet.length > 150) {
                  // Find the best position to show the snippet
                  const queryTerms = query.split(/\s+/);
                  let bestPosition = 0;
                  let longestMatch = 0;

                  // Find position of the longest matching term
                  for (const term of queryTerms) {
                    if (term.length > 1) {
                      const termPos = snippet.indexOf(term);
                      if (termPos !== -1 && term.length > longestMatch) {
                        bestPosition = termPos;
                        longestMatch = term.length;
                      }
                    }
                  }

                  // Create a snippet around the best match position
                  const startPos = Math.max(0, bestPosition - 40);
                  const endPos = Math.min(snippet.length, bestPosition + 100);

                  snippet = (startPos > 0 ? '...' : '') + 
                    snippet.substring(startPos, endPos) + 
                    (endPos < snippet.length ? '...' : '');
                }

                // Highlight the actual search terms, not just any match
                const queryTerms = query.split(/\s+/).filter(term => term.length > 1);
                let highlightedSnippet = snippet;

                for (const term of queryTerms) {
                  if (term.length > 1) {
                    // Create a regular expression to find the term with word boundaries
                    // This helps ensure we're highlighting whole words, not parts of words
                    const regex = new RegExp(`(${term})`, 'gi');
                    highlightedSnippet = highlightedSnippet.replace(regex, '<mark>$1</mark>');
                  }
                }

                // Convert newlines to <br> tags for HTML display
                highlightedSnippet = highlightedSnippet.replace(/\n/g, '<br>');

                highlightedSnippets.push(`<div class="match-snippet"><strong>${displayKey}:</strong> ${highlightedSnippet}</div>`);
              }
            }
          });

          // Limit to 3 snippets maximum
          highlightedSnippets = highlightedSnippets.slice(0, 3);

          return `
                  <div class="search-result-item">
                  <a href="${item.permalink}">
                  <h3>${item.program_type || ''} ${item.program_number || ''}</h3>
                  <div class="search-meta">
                  ${item.dastgah ? `<span>دستگاه: ${item.dastgah}</span>` : ''}
                  ${item.singers && item.singers.length ? `<span>خواننده: ${item.singers.join('، ')}</span>` : ''}
                  </div>
                  ${highlightedSnippets.length ? 
                  `<div class="match-highlights">${highlightedSnippets.join('')}</div>` : 
                  '<div class="match-highlights">محل تطابق جستجو نشان داده نشد</div>'}
                  </a>
                  </div>
`;
        }).join('');


    searchResults.style.display = 'block';
  } else {
    searchResults.innerHTML = '<div class="no-results">نتیجه‌ای یافت نشد</div>';
    searchResults.style.display = 'block';
  }

    }
  });

  // Hide search results when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
});
