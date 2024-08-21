document.addEventListener('DOMContentLoaded', function() {
    flatpickr("#dateRange", {
        mode: "multiple",
        dateFormat: "Y-m-d",
        minDate: "today",
        onChange: function(selectedDates) {
            const selectedDatesStr = selectedDates.map(date => date.toISOString().split('T')[0]);
            checkAvailability(selectedDatesStr);
        }
    });

    const numberOfPeopleInput = document.getElementById('numberOfPeople');
    const accommodationSelect = document.getElementById('accommodation');
    const breakfastSelect = document.getElementById('breakfast');

    numberOfPeopleInput.addEventListener('change', calculatePrice);
    accommodationSelect.addEventListener('change', function() {
        calculatePrice();
        checkAvailability(document.getElementById('dateRange').value.split(','));
    });
    breakfastSelect.addEventListener('change', calculatePrice);

    calculatePrice();

    setupPayPalButton();
});

function calculatePrice() {
    const numberOfPeople = parseInt(document.getElementById('numberOfPeople').value);
    const accommodation = document.getElementById('accommodation').value;
    const breakfast = document.getElementById('breakfast').value;

    let totalPrice = 0;

    if (accommodation === 'fullRoom') {
        totalPrice = 75;
    } else if (accommodation === 'dormitory') {
        totalPrice = 20 * numberOfPeople;
    }

    if (breakfast === 'included') {
        totalPrice += 5 * numberOfPeople;
    }

    document.getElementById('price').textContent = `${totalPrice}€`;
    window.totalPrice = totalPrice; // Stocke le prix total pour l'utiliser lors du paiement
}

async function checkAvailability(selectedDates) {
    try {
        const dbRef = ref(window.db, 'rooms');
        const snapshot = await get(dbRef);

        if (snapshot.exists()) {
            const roomsData = snapshot.val();
            updateAvailability(roomsData, selectedDates);
        } else {
            console.log("No rooms available.");
        }
    } catch (error) {
        console.error("Error fetching rooms data: ", error);
    }
}

function updateAvailability(roomsData, selectedDates) {
    // Fonction pour mettre à jour la disponibilité des chambres
    console.log('Rooms data:', roomsData);
    console.log('Selected dates:', selectedDates);
    // Ajoutez ici la logique pour mettre à jour l'interface utilisateur en fonction des données des chambres et des dates sélectionnées
}

function setupPayPalButton() {
    paypal.Buttons({
        createOrder: function(data, actions) {
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: window.totalPrice.toFixed(2) // Prix total pour le paiement
                    }
                }]
            });
        },
        onApprove: async function(data, actions) {
            return actions.order.capture().then(async function(details) {
                console.log('Transaction completed by ' + details.payer.name.given_name);

                // Effectuer la réservation dans la base de données après paiement
                const selectedDates = document.getElementById('dateRange').value.split(',');
                const numberOfPeople = parseInt(document.getElementById('numberOfPeople').value);
                const accommodation = document.getElementById('accommodation').value;
                const roomType = document.getElementById('roomType').value;
                const breakfast = document.getElementById('breakfast').value;

                try {
                    const roomRef = ref(window.db, `rooms/${roomType}`);
                    const roomSnapshot = await get(roomRef);

                    if (roomSnapshot.exists()) {
                        const roomData = roomSnapshot.val();
                        let isAvailable = true;

                        for (const dateStr of selectedDates) {
                            const currentAvailability = roomData.availability?.[dateStr];
                            const totalPlaces = roomData.total_places;

                            if (accommodation === 'fullRoom') {
                                if (currentAvailability < totalPlaces) {
                                    isAvailable = false;
                                    break;
                                }
                            } else {
                                if (currentAvailability < numberOfPeople) {
                                    isAvailable = false;
                                    break;
                                }
                            }
                        }

                        if (isAvailable) {
                            for (const dateStr of selectedDates) {
                                const currentAvailability = roomData.availability?.[dateStr] ?? roomData.total_places;
                                const newAvailability = accommodation === 'fullRoom'
                                    ? 0
                                    : currentAvailability - numberOfPeople;

                                await update(roomRef, {
                                    [`availability/${dateStr}`]: newAvailability
                                });
                            }

                            const reservationsRef = ref(window.db, 'reservations');
                            const newReservationRef = push(reservationsRef);
                            await set(newReservationRef, {
                                dateRange: selectedDates.join(','),
                                numberOfPeople: numberOfPeople,
                                accommodation: accommodation,
                                roomType: roomType,
                                breakfast: breakfast,
                                payerId: details.payer.payer_id // Ajout de l'identifiant PayPal du payeur
                            });

                            alert('Réservation réussie !');
                        } else {
                            alert('Pas assez de disponibilité pour les dates sélectionnées.');
                        }
                    } else {
                        alert('Données de la chambre introuvables !');
                    }
                } catch (error) {
                    console.error("Erreur lors du traitement de la réservation: ", error);
                    alert(`Erreur lors de la réservation: ${error.message}`);
                }
            });
        },
        onError: function(err) {
            console.error('Erreur lors du paiement: ', err);
            alert('Une erreur est survenue lors du paiement. Veuillez réessayer.');
        }
    }).render('#paypal-button-container');
}
