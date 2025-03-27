const map = L.map('map').setView([34.05, -118.25], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

function loadAllCitations() {
  fetch('/api/citations')
    .then(res => res.json())
    .then(data => {
      data.forEach(c => {
        L.marker([c.latitude, c.longitude])
          .addTo(map)
          .bindPopup(c.location || 'No location');
      });
    });
}

loadAllCitations();

function search() {
  const query = document.getElementById("search").value;
  const status = document.getElementById("status");
  status.textContent = "Searching...";

  if (!query) {
    status.textContent = "Please enter an address.";
    return;
  }

  fetch(`/api/search?address=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Rectangle) {
          map.removeLayer(layer);
        }
      });

      loadAllCitations();

      if (data.length > 0) {
        const lat = data[0].latitude;
        const lng = data[0].longitude;

        data.forEach(c => {
          L.marker([c.latitude, c.longitude])
            .addTo(map)
            .bindPopup(`${c.location}<br>Distance: ${c.distance_km.toFixed(2)} km`);
        });

        const offset = 0.0145;
        const bounds = [
          [lat - offset, lng - offset],
          [lat + offset, lng + offset]
        ];

        L.rectangle(bounds, { color: "#1a73e8", weight: 2, fillOpacity: 0.2 }).addTo(map);
        map.setView([lat, lng], 16);
        status.textContent = `${data.length} citations found nearby.`;
      } else {
        status.textContent = "No citations found in this area.";
        fetch(`/api/geocode?address=${encodeURIComponent(query)}`)
          .then(res => res.json())
          .then(loc => {
            if (loc.lat && loc.lng) {
              const offset = 0.0145;
              const bounds = [
                [loc.lat - offset, loc.lng - offset],
                [loc.lat + offset, loc.lng + offset]
              ];
              L.rectangle(bounds, { color: "#f44336", weight: 2, fillOpacity: 0.2 }).addTo(map);
              map.setView([loc.lat, loc.lng], 16);
            }
          });
      }
    })
    .catch(() => {
      status.textContent = "Search failed. Try again.";
    });
}
