document.addEventListener('DOMContentLoaded', () => {
    const businessNameInput = document.getElementById('businessName');
    const keywordInput = document.getElementById('keyword');
    const centralLocationInput = document.getElementById('centralLocation');
    const gridSizeInput = document.getElementById('gridSize');
    const distanceBetweenPointsInput = document.getElementById('distanceBetweenPoints');
    const generateGridButton = document.getElementById('generateGrid');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const mapDiv = document.getElementById('map');
    const resultsDiv = document.getElementById('results');

    let map;
    let geocoder;
    let markers = []; // Keep track of markers to clear them

    window.initMap = () => {
        map = new google.maps.Map(mapDiv, {
            center: { lat: -34.397, lng: 150.644 }, // Default center (Sydney)
            zoom: 8,
        });
        geocoder = new google.maps.Geocoder();
    };

    const clearMarkers = () => {
        for (let i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }
        markers = [];
    };

    generateGridButton.addEventListener('click', () => {
        const businessName = businessNameInput.value;
        const keyword = keywordInput.value;
        const centralLocation = centralLocationInput.value;
        const gridSize = gridSizeInput.value;
        const distanceBetweenPoints = parseFloat(distanceBetweenPointsInput.value);

        if (!keyword || !centralLocation || !gridSize || isNaN(distanceBetweenPoints)) {
            alert('Please fill in all required fields.');
            return;
        }

        const [gridRows, gridCols] = gridSize.split('x').map(Number);
        const totalPoints = gridRows * gridCols;

        if (totalPoints > 25) {
            if (!confirm(`This will use ${totalPoints} API credits. Are you sure you want to continue?`)) {
                return; // Stop if the user cancels
            }
        }

        // Show loading spinner
        buttonText.style.display = 'none';
        loadingSpinner.style.display = 'inline-block';
        generateGridButton.disabled = true; // Disable button during processing

        resultsDiv.innerHTML = '<h2>Generating Grid and Tracking Ranks...</h2>';
        clearMarkers(); // Clear old markers from the map

        geocoder.geocode({ 'address': centralLocation }, (results, status) => {
            if (status === 'OK') {
                const centerLat = results[0].geometry.location.lat();
                const centerLng = results[0].geometry.location.lng();
                map.setCenter(results[0].geometry.location);
                map.setZoom(12); // Adjust zoom level as needed

                const distanceKm = distanceBetweenPoints * 1.60934; // Convert miles to kilometers

                const gridPoints = [];
                for (let i = 0; i < gridRows; i++) {
                    for (let j = 0; j < gridCols; j++) {
                        const latOffset = (i - Math.floor(gridRows / 2)) * (distanceKm / 111.32);
                        const lngOffset = (j - Math.floor(gridCols / 2)) * (distanceKm / (111.32 * Math.cos(centerLat * Math.PI / 180)));
                        const pointLat = centerLat + latOffset;
                        const pointLng = centerLng + lngOffset;
                        gridPoints.push({ lat: pointLat, lng: pointLng });
                    }
                }

                resultsDiv.innerHTML = `
                    <h2>Grid Generation Details:</h2>
                    <p><strong>Business Name:</strong> ${businessName || 'N/A'}</p>
                    <p><strong>Keyword:</strong> ${keyword}</p>
                    <p><strong>Central Location:</strong> ${centralLocation}</p>
                    <p><strong>Grid Size:</strong> ${gridSize}</p>
                    <p><strong>Distance Between Points:</strong> ${distanceBetweenPoints} miles</p>
                    <p><strong>Generated Points:</strong> ${gridPoints.length}</p>
                    <p><em>Fetching ranks... (this may take a moment due to API delays)</em></p>
                `;

                fetch('http://localhost:3000/track-ranks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessName, keyword, gridPoints }),
                })
                .then(response => response.json())
                .then(data => {
                    // Hide loading spinner
                    buttonText.style.display = 'inline';
                    loadingSpinner.style.display = 'none';
                    generateGridButton.disabled = false; // Re-enable button

                    if (data.success) {
                        resultsDiv.innerHTML += '<p><strong>Ranking data received. Displaying on map.</strong></p>';
                        
                        const getMarkerIcon = (rank, status, labelText) => {
                            let color = '#FF0000'; // Red (default for errors/Not Found)
                            if (rank >= 1 && rank <= 3) {
                                color = '#00E64D'; // Bright Green
                            } else if (rank >= 4 && rank <= 10) {
                                color = '#00A33A'; // Darker Green
                            } else if (rank >= 11 && rank <= 20) {
                                color = '#FFA500'; // Orange
                            } else if (rank > 20) {
                                color = '#FF0000'; // Red for ranks > 20
                            }

                            // Use modern inline SVG for markers to avoid ad-blocker issues
                            const svgIcon = {
                                path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                                fillColor: color,
                                fillOpacity: 1,
                                strokeWeight: 1,
                                strokeColor: '#000000',
                                scale: 1.5,
                                labelOrigin: new google.maps.Point(0, -29),
                            };

                            return svgIcon;
                        };

                        data.results.forEach(point => {
                            let labelText = 'E';
                            if (point.rank > 0) {
                                labelText = String(point.rank);
                            } else if (point.status === 'Not Found') {
                                labelText = 'NF';
                            }

                            const marker = new google.maps.Marker({
                                position: { lat: point.lat, lng: point.lng },
                                map: map,
                                title: `Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)}\nStatus: ${point.status}`,
                                icon: getMarkerIcon(point.rank, point.status, labelText),
                                label: {
                                    text: labelText,
                                    color: "white",
                                    fontSize: "12px",
                                    fontWeight: "bold"
                                }
                            });

                            const infoWindow = new google.maps.InfoWindow({
                                content: `<strong>Keyword:</strong> ${keyword}<br><strong>Status:</strong> ${point.status}<br>Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)}`
                            });

                            marker.addListener('click', () => {
                                infoWindow.open(map, marker);
                            });
                            markers.push(marker);
                        });
                    } else {
                        resultsDiv.innerHTML += '<p><strong>Error fetching ranking data.</strong></p>';
                    }
                })
                .catch(error => {
                    // Hide loading spinner
                    buttonText.style.display = 'inline';
                    loadingSpinner.style.display = 'none';
                    generateGridButton.disabled = false; // Re-enable button

                    console.error('Error:', error);
                    resultsDiv.innerHTML += '<p><strong>Error communicating with backend.</strong></p>';
                });

            } else {
                // Hide loading spinner
                buttonText.style.display = 'inline';
                loadingSpinner.style.display = 'none';
                generateGridButton.disabled = false; // Re-enable button

                resultsDiv.innerHTML = `<h2>Geocoding Error:</h2><p>Geocode was not successful for the following reason: ${status}</p>`;
            }
        });
    });
});
