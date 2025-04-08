// Initialize map
const map = L.map('map').setView([34.05, -118.25], 12);

// Store marker layers by type
const markerLayers = {
  citations: new L.LayerGroup(),
  crimes: new L.LayerGroup(),
  user_reports: new L.LayerGroup()
};

// Search overlay layer group - for displaying search results
const searchResultsLayer = new L.LayerGroup();

// Add search layer to map
map.addLayer(searchResultsLayer);

// Define marker icons for different data types
const markerIcons = {
  citations: L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #1e88e5;"></i>',
    className: 'marker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  }),
  crimes: L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #e53935;"></i>',
    className: 'marker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  }),
  user_reports: L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #43a047;"></i>',
    className: 'marker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  }),
  // Highlight icon for search results
  search_result: L.divIcon({
    html: '<i class="fas fa-star" style="color: #ffc107;"></i>',
    className: 'marker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  })
};

// Store all data for local search
let allData = {
  citations: [],
  crimes: [],
  user_reports: []
};

// Add base map layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add marker layers to the map
Object.values(markerLayers).forEach(layer => map.addLayer(layer));

// Global state for keeping track of current report being edited
let currentReportId = null;
let currentEditKey = null;

// Initialize Google Places Autocomplete
function googleMapsLoaded() {
  try {
    initAutocomplete();
    initReportAutocomplete();
  } catch (e) {
    console.error("Error initializing Google Places:", e);
    document.getElementById('status').textContent = 
      "Address autocomplete unavailable. Search functionality still works.";
  }
}

// Initialize the Google Places autocomplete for search
function initAutocomplete() {
  const input = document.getElementById('search');
  
  if (!input || !google || !google.maps || !google.maps.places) {
    console.warn("Google Maps Places API not available or search input not found");
    return;
  }
  
  // Create autocomplete object
  const autocomplete = new google.maps.places.Autocomplete(input, {
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(33.7, -118.6), // SW corner of LA
      new google.maps.LatLng(34.4, -117.8)  // NE corner of LA
    ),
    componentRestrictions: { country: 'us' },
    fields: ['place_id', 'geometry', 'name', 'formatted_address'],
    types: ['address'] 
  });
  
  // Handle place selection
  autocomplete.addListener('place_changed', function() {
    const place = autocomplete.getPlace();
    if (place && place.geometry && place.geometry.location) {
      // We can use the place directly without using the geocode API
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      searchNearby(lat, lng);
    } else {
      document.getElementById('status').textContent = "Please select a place from the dropdown.";
    }
  });
  
  console.log("Google Places Autocomplete initialized successfully");
}

// Initialize autocomplete for the report form
function initReportAutocomplete() {
  const input = document.getElementById('report-location');
  
  if (!input || !google || !google.maps || !google.maps.places) {
    return;
  }
  
  const autocomplete = new google.maps.places.Autocomplete(input, {
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(33.7, -118.6),
      new google.maps.LatLng(34.4, -117.8)
    ),
    componentRestrictions: { country: 'us' },
    fields: ['formatted_address', 'geometry'],
    types: ['address']
  });
}

// Helper function to format date
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
}

// Load all data from all sources
function loadAllData() {
  // Clear existing markers
  Object.values(markerLayers).forEach(layer => layer.clearLayers());
  searchResultsLayer.clearLayers();
  
  // Show loading message
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = "Loading data...";
  }
  
  // Fetch all data from the API
  fetch('/api/all-data')
    .then(res => res.json())
    .then(data => {
      console.log("Received data:", data);
      
      // Store the data for local search
      allData = data;
      
      // Add markers for each data type
      addMarkersToMap(data.citations, 'citations');
      addMarkersToMap(data.crimes, 'crimes');
      addMarkersToMap(data.user_reports, 'user_reports');
      
      // Update status
      if (statusEl) {
        statusEl.textContent = `Loaded ${data.citations.length} citations, ${data.crimes.length} crimes, and ${data.user_reports.length} user reports.`;
      }
    })
    .catch(error => {
      console.error("Error loading data:", error);
      if (statusEl) {
        statusEl.textContent = "Error loading data.";
      }
    });
}

// Add markers to the map for a specific data type
function addMarkersToMap(items, dataType) {
  if (!items || items.length === 0) {
    console.log(`No ${dataType} to display`);
    return;
  }
  
  console.log(`Adding ${items.length} ${dataType} to map`);
  
  items.forEach(item => {
    // Skip if missing coordinates
    if (!item.latitude || !item.longitude) {
      console.log("Skipping item with missing coordinates:", item);
      return;
    }
    
    try {
      // Convert to numbers if they're strings
      const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
      const lng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;
      
      // Skip if not valid numbers
      if (isNaN(lat) || isNaN(lng)) {
        console.log("Invalid coordinates:", item.latitude, item.longitude);
        return;
      }
      
      // Create marker with appropriate icon
      const marker = L.marker([lat, lng], {
        icon: markerIcons[dataType]
      });
      
      // Create popup content based on data type
      let popupContent = '';
      
      if (dataType === 'citations') {
        popupContent = `
          <strong>Citation</strong><br>
          Location: ${item.location || 'Unknown'}<br>
          ${item.description ? `Violation: ${item.description}<br>` : ''}
          ${item.fine_amount ? `Fine: $${item.fine_amount}<br>` : ''}
          ${item.issue_date ? `Date: ${formatDate(item.issue_date)}<br>` : ''}
          ${item.make ? `Vehicle: ${item.make} ${item.body_style || ''}<br>` : ''}
          ${item.state ? `License: ${item.state}<br>` : ''}
          <br>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
        `;
      } else if (dataType === 'crimes') {
        popupContent = `
          <strong>Crime</strong><br>
          Location: ${item.location || 'Unknown'}<br>
          ${item.description ? `Description: ${item.description}<br>` : ''}
          ${item.datetime ? `Date: ${formatDate(item.datetime)}<br>` : ''}
          ${item.crime_code ? `Code: ${item.crime_code}<br>` : ''}
          <br>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
        `;
      } else if (dataType === 'user_reports') {
        popupContent = `
          <strong>User Report</strong><br>
          Location: ${item.location || 'Unknown'}<br>
          ${item.description ? `Violation: ${item.description}<br>` : ''}
          ${item.fine_amount ? `Fine: $${item.fine_amount}<br>` : ''}
          ${item.issue_date ? `Date: ${formatDate(item.issue_date)}<br>` : ''}
          <br>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
          <br><button onclick="showReportDetail(${item.id})">View Details</button>
        `;
      }
      
      // Bind popup to marker
      marker.bindPopup(popupContent);
      
      // Add marker to the appropriate layer
      markerLayers[dataType].addLayer(marker);
    } catch (e) {
      console.error("Error adding marker:", e, item);
    }
  });
}

// Toggle visibility of a data layer
function toggleDataLayer(dataType) {
  try {
    const checkbox = document.getElementById(`toggle-${dataType}`);
    if (checkbox && checkbox.checked) {
      map.addLayer(markerLayers[dataType]);
    } else if (checkbox) {
      map.removeLayer(markerLayers[dataType]);
    }
  } catch (e) {
    console.error(`Error toggling ${dataType}:`, e);
  }
}

// Search function that gets called when clicking Search button
function search() {
  const query = document.getElementById("search").value;
  const status = document.getElementById("status");
  
  if (!query) {
    if (status) status.textContent = "Please enter an address.";
    return;
  }
  
  if (status) status.textContent = "Searching...";
  
  // Use Google's Geocoder directly without going through our API
  if (google && google.maps && google.maps.Geocoder) {
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address: query }, (results, geocodeStatus) => {
      if (geocodeStatus === 'OK' && results && results[0] && results[0].geometry) {
        const location = results[0].geometry.location;
        searchNearby(location.lat(), location.lng());
      } else {
        console.error("Geocoding failed:", geocodeStatus);
        if (status) status.textContent = "Could not find that address.";
      }
    });
  } else {
    // Fallback if Google Maps API isn't available
    if (status) status.textContent = "Geocoding service is not available.";
  }
}

// Function to search for nearby items given a lat/lng
function searchNearby(lat, lng) {
  console.log(`Searching near ${lat}, ${lng}`);
  const status = document.getElementById("status");
  
  // Get checked data types for search
  const dataTypes = [];
  const citationsToggle = document.getElementById('toggle-citations');
  const crimesToggle = document.getElementById('toggle-crimes');
  const userReportsToggle = document.getElementById('toggle-user-reports');
  
  if (citationsToggle && citationsToggle.checked) dataTypes.push('citations');
  if (crimesToggle && crimesToggle.checked) dataTypes.push('crimes');
  if (userReportsToggle && userReportsToggle.checked) dataTypes.push('user_reports');
  
  // Default to all types if no checkboxes found
  if (dataTypes.length === 0) {
    dataTypes.push('citations', 'crimes', 'user_reports');
  }
  
  // Clear previous search results layer
  searchResultsLayer.clearLayers();
  
  // Remove any existing rectangles
  map.eachLayer(layer => {
    if (layer instanceof L.Rectangle) {
      map.removeLayer(layer);
    }
  });
  
  // Define search radius in km
  const searchRadius = 1.0;
  const results = {
    citations: [],
    crimes: [],
    user_reports: []
  };
  
  // Filter data types
  dataTypes.forEach(dataType => {
    if (allData[dataType] && allData[dataType].length > 0) {
      results[dataType] = allData[dataType].filter(item => {
        if (!item.latitude || !item.longitude) return false;
        
        const itemLat = parseFloat(item.latitude);
        const itemLng = parseFloat(item.longitude);
        
        if (isNaN(itemLat) || isNaN(itemLng)) return false;
        
        const distance = getDistanceFromLatLonInKm(
          lat, lng, itemLat, itemLng
        );
        return distance <= searchRadius;
      });
      console.log(`Found ${results[dataType].length} nearby ${dataType}`);
    }
  });
  
  // Add highlight markers for search results
  let totalResults = 0;
  for (const dataType in results) {
    if (results[dataType].length > 0) {
      // Add star markers to the search results layer
      results[dataType].forEach(item => {
        try {
          const itemLat = parseFloat(item.latitude);
          const itemLng = parseFloat(item.longitude);
          
          if (!isNaN(itemLat) && !isNaN(itemLng)) {
            const marker = L.circleMarker([itemLat, itemLng], {
              radius: 12,
              color: '#ffc107',
              weight: 2,
              opacity: 0.8,
              fillColor: '#ffc107',
              fillOpacity: 0.3
            });
            
            searchResultsLayer.addLayer(marker);
          }
        } catch (e) {
          console.error("Error adding search highlight:", e);
        }
      });
      
      totalResults += results[dataType].length;
    }
  }
  
  // Add rectangle and center map
  const offset = 0.0145;
  const bounds = [
    [lat - offset, lng - offset],
    [lat + offset, lng + offset]
  ];
  
  const rectColor = totalResults > 0 ? "#1a73e8" : "#f44336";
  L.rectangle(bounds, { color: rectColor, weight: 2, fillOpacity: 0.2 }).addTo(map);
  map.setView([lat, lng], 16);
  
  if (status) {
    if (totalResults > 0) {
      status.textContent = `${totalResults} results found nearby.`;
    } else {
      status.textContent = "No results found in this area.";
    }
  }
}

// Calculate distance between two points in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Show the report submission form
function showReportForm() {
  const form = document.getElementById('report-form');
  if (form) form.reset();
  
  currentReportId = null;
  currentEditKey = null;
  
  // Update form title to indicate we're creating a new report
  const formHeader = document.querySelector('#report-form-container .form-header h2');
  if (formHeader) formHeader.textContent = 'Submit Parking Citation Report';
  
  // Update submit button
  const submitBtn = document.querySelector('#report-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Submit Report';
  
  // Show the form
  const formContainer = document.getElementById('report-form-container');
  if (formContainer) formContainer.classList.remove('hidden');
}

// Hide the report submission form
function hideReportForm() {
  const formContainer = document.getElementById('report-form-container');
  if (formContainer) formContainer.classList.add('hidden');
}

// Submit a new report or update an existing one
function submitReport(event) {
  event.preventDefault();
  
  const locationInput = document.getElementById('report-location');
  const violationInput = document.getElementById('report-violation');
  const fineInput = document.getElementById('report-fine');
  
  if (!locationInput || !violationInput || !fineInput) {
    console.error("Required form elements not found");
    return;
  }
  
  // Get form data
  const formData = {
    location: locationInput.value,
    violation_desc: violationInput.value,
    fine_amount: parseFloat(fineInput.value)
  };
  
  // Add optional fields if they're filled
  const plate = document.getElementById('report-plate');
  if (plate && plate.value) formData.plate = plate.value;
  
  const state = document.getElementById('report-state');
  if (state && state.value) formData.state = state.value;
  
  const make = document.getElementById('report-make');
  if (make && make.value) formData.make = make.value;
  
  const model = document.getElementById('report-model');
  if (model && model.value) formData.model = model.value;
  
  const color = document.getElementById('report-color');
  if (color && color.value) formData.color = color.value;
  
  // Get coordinates from Google Places if possible
  if (google && google.maps && google.maps.places && locationInput.value) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: locationInput.value }, (results, status) => {
      if (status === 'OK' && results && results[0] && results[0].geometry) {
        const location = results[0].geometry.location;
        formData.latitude = location.lat();
        formData.longitude = location.lng();
        submitReportWithData(formData);
      } else {
        // Submit without coordinates, let backend geocode
        submitReportWithData(formData);
      }
    });
  } else {
    // Submit without coordinates, let backend geocode
    submitReportWithData(formData);
  }
}

// Helper function to actually submit the report data
function submitReportWithData(formData) {
  // Determine if we're creating a new report or updating an existing one
  const isUpdate = currentReportId !== null && currentEditKey !== null;
  const url = isUpdate ? `/api/user-reports/${currentReportId}` : '/api/user-reports';
  const method = isUpdate ? 'PUT' : 'POST';
  
  // Set up headers for edit key if updating
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (isUpdate) {
    headers['X-Edit-Key'] = currentEditKey;
  }
  
  // Send request to the API
  fetch(url, {
    method: method,
    headers: headers,
    body: JSON.stringify(formData)
  })
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to submit report');
      }
      return res.json();
    })
    .then(data => {
      // Store edit key for new reports
      if (!isUpdate && data.edit_key) {
        // Save edit key in local storage for future edits
        const savedReports = JSON.parse(localStorage.getItem('userReports') || '{}');
        savedReports[data.report_id] = data.edit_key;
        localStorage.setItem('userReports', JSON.stringify(savedReports));
      }
      
      // Hide the form
      hideReportForm();
      
      // Show success message
      const status = document.getElementById('status');
      if (status) {
        status.textContent = isUpdate ? 'Report updated successfully!' : 'Report submitted successfully!';
      }
      
      // Reload data to show the new/updated report
      loadAllData();
    })
    .catch(error => {
      console.error('Error submitting report:', error);
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Error submitting report. Please try again.';
      }
    });
}

// Show report details
function showReportDetail(reportId) {
  // Set current report ID
  currentReportId = reportId;
  
  // Check if we have an edit key for this report in local storage
  const savedReports = JSON.parse(localStorage.getItem('userReports') || '{}');
  currentEditKey = savedReports[reportId];
  
  // Fetch report details
  fetch(`/api/user-reports/${reportId}`)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to fetch report details');
      }
      return res.json();
    })
    .then(report => {
      // Populate detail container
      const detailContent = document.getElementById('report-detail-content');
      if (!detailContent) return;
      
      detailContent.innerHTML = `
        <div class="detail-item">
          <span class="detail-label">Location</span>
          <span class="detail-value">${report.location || 'Not specified'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Violation</span>
          <span class="detail-value">${report.violation_desc || 'Not specified'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Fine Amount</span>
          <span class="detail-value">$${report.fine_amount || '0.00'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Date Reported</span>
          <span class="detail-value">${formatDate(report.issue_date)}</span>
        </div>
        ${report.plate ? `
        <div class="detail-item">
          <span class="detail-label">License Plate</span>
          <span class="detail-value">${report.plate}${report.state ? ` (${report.state})` : ''}</span>
        </div>` : ''}
        ${report.make || report.model ? `
        <div class="detail-item">
          <span class="detail-label">Vehicle</span>
          <span class="detail-value">${[report.make, report.model].filter(Boolean).join(' ')}${report.color ? `, ${report.color}` : ''}</span>
        </div>` : ''}
        <div class="detail-item">
          <span class="detail-label">Report Created</span>
          <span class="detail-value">${formatDate(report.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Coordinates</span>
          <span class="detail-value">${report.latitude}, ${report.longitude}</span>
        </div>
      `;
      
      // Add action buttons only if we have an edit key
      const actionsContainer = document.getElementById('report-detail-actions');
      if (!actionsContainer) return;
      
      if (currentEditKey) {
        actionsContainer.innerHTML = `
          <button type="button" class="edit-btn" onclick="editReport(${reportId})">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button type="button" class="delete-btn" onclick="deleteReport(${reportId})">
            <i class="fas fa-trash"></i> Delete
          </button>
        `;
      } else {
        actionsContainer.innerHTML = `
          <p class="no-edit-message">You can only edit reports that you created.</p>
        `;
      }
      
      // Show the detail container
      const detailContainer = document.getElementById('report-detail-container');
      if (detailContainer) detailContainer.classList.remove('hidden');
    })
    .catch(error => {
      console.error('Error fetching report details:', error);
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Error fetching report details.';
      }
    });
}

// Hide report details
function hideReportDetail() {
  const detailContainer = document.getElementById('report-detail-container');
  if (detailContainer) detailContainer.classList.add('hidden');
  currentReportId = null;
}

// Edit a report
function editReport(reportId) {
  if (!currentEditKey) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'You do not have permission to edit this report.';
    }
    return;
  }
  
  // Fetch report details to populate the form
  fetch(`/api/user-reports/${reportId}`)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to fetch report details');
      }
      return res.json();
    })
    .then(report => {
      // Set current report ID
      currentReportId = reportId;
      
      // Populate form fields
      const locationInput = document.getElementById('report-location');
      const violationInput = document.getElementById('report-violation');
      const fineInput = document.getElementById('report-fine');
      
      if (locationInput) locationInput.value = report.location || '';
      if (violationInput) violationInput.value = report.violation_desc || '';
      if (fineInput) fineInput.value = report.fine_amount || '';
      
      // Populate optional fields if they exist in the form
      const plateInput = document.getElementById('report-plate');
      if (plateInput && report.plate) plateInput.value = report.plate;
      
      const stateInput = document.getElementById('report-state');
      if (stateInput && report.state) stateInput.value = report.state;
      
      const makeInput = document.getElementById('report-make');
      if (makeInput && report.make) makeInput.value = report.make;
      
      const modelInput = document.getElementById('report-model');
      if (modelInput && report.model) modelInput.value = report.model;
      
      const colorInput = document.getElementById('report-color');
      if (colorInput && report.color) colorInput.value = report.color;
      
      // Update form title to indicate we're editing
      const formHeader = document.querySelector('#report-form-container .form-header h2');
      if (formHeader) formHeader.textContent = 'Edit Parking Citation Report';
      
      // Update submit button
      const submitBtn = document.querySelector('#report-form button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Report';
      
      // Hide the detail view and show the form
      hideReportDetail();
      const formContainer = document.getElementById('report-form-container');
      if (formContainer) formContainer.classList.remove('hidden');
    })
    .catch(error => {
      console.error('Error fetching report for editing:', error);
      const status = document.getElementById('status');
      if (status) {
        status.textContent = 'Error fetching report for editing.';
      }
    });
}

// Delete a report
function deleteReport(reportId) {
  if (!currentEditKey) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'You do not have permission to delete this report.';
    }
    return;
  }
  
  if (confirm('Are you sure you want to delete this report?')) {
    fetch(`/api/user-reports/${reportId}`, {
      method: 'DELETE',
      headers: {
        'X-Edit-Key': currentEditKey
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to delete report');
        }
        return res.json();
      })
      .then(data => {
        // Remove from local storage
        const savedReports = JSON.parse(localStorage.getItem('userReports') || '{}');
        delete savedReports[reportId];
        localStorage.setItem('userReports', JSON.stringify(savedReports));
        
        // Hide the detail view
        hideReportDetail();
        
        // Show success message
        const status = document.getElementById('status');
        if (status) {
          status.textContent = 'Report deleted successfully!';
        }
        
        // Reload data to update the map
        loadAllData();
      })
      .catch(error => {
        console.error('Error deleting report:', error);
        const status = document.getElementById('status');
        if (status) {
          status.textContent = 'Error deleting report.';
        }
      });
  }
}

// Load data when the page loads
document.addEventListener('DOMContentLoaded', function() {
  loadAllData();
});