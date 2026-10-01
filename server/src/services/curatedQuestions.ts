import type { Category, QuestionData } from '../../../shared/src/index';

export const CURATED_QUESTIONS: Omit<QuestionData, 'packId'>[] = [
  // ==========================================
  // ART & LITERATURE (30 questions)
  // ==========================================
  {
    id: 'art_1',
    category: 'ART',
    question: 'Who painted the famous masterpiece "The Starry Night"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/640px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    correctAnswer: 'Vincent van Gogh',
    incorrectAnswers: ['Claude Monet', 'Pablo Picasso', 'Salvador Dalí'],
    difficulty: 'easy'
  },
  {
    id: 'art_2',
    category: 'ART',
    question: 'Which Renaissance artist sculpted the famous statue of David in Florence?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Michelangelo%27s_David_-_original_in_the_Galleria_dell%27Accademia_in_Florence.jpg/480px-Michelangelo%27s_David_-_original_in_the_Galleria_dell%27Accademia_in_Florence.jpg',
    correctAnswer: 'Michelangelo',
    incorrectAnswers: ['Leonardo da Vinci', 'Donatello', 'Raphael'],
    difficulty: 'easy'
  },
  {
    id: 'art_3',
    category: 'ART',
    question: 'Who painted this iconic surrealist work featuring melting clocks, titled "The Persistence of Memory"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/d/dd/The_Persistence_of_Memory.jpg',
    correctAnswer: 'Salvador Dalí',
    incorrectAnswers: ['René Magritte', 'Max Ernst', 'Joan Miró'],
    difficulty: 'medium'
  },
  {
    id: 'art_4',
    category: 'ART',
    question: 'In which famous Parisian museum is Leonardo da Vinci\'s "Mona Lisa" permanently housed?',
    correctAnswer: 'The Louvre',
    incorrectAnswers: ['Musée d\'Orsay', 'Centre Pompidou', 'The Prado'],
    difficulty: 'easy'
  },
  {
    id: 'art_5',
    category: 'ART',
    question: 'Who is the author of the epic tragic play "Romeo and Juliet"?',
    correctAnswer: 'William Shakespeare',
    incorrectAnswers: ['Christopher Marlowe', 'John Milton', 'Charles Dickens'],
    difficulty: 'easy'
  },
  {
    id: 'art_6',
    category: 'ART',
    question: 'Which Norwegian artist painted the haunting expressionist piece "The Scream"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/480px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg',
    correctAnswer: 'Edvard Munch',
    incorrectAnswers: ['Gustav Klimt', 'Egon Schiele', 'Wassily Kandinsky'],
    difficulty: 'easy'
  },
  {
    id: 'art_7',
    category: 'ART',
    question: 'Who wrote the groundbreaking dystopian novel "1984"?',
    correctAnswer: 'George Orwell',
    incorrectAnswers: ['Aldous Huxley', 'Ray Bradbury', 'Philip K. Dick'],
    difficulty: 'easy'
  },
  {
    id: 'art_8',
    category: 'ART',
    question: 'Which Dutch painter created the striking portrait "Girl with a Pearl Earring"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/480px-1665_Girl_with_a_Pearl_Earring.jpg',
    correctAnswer: 'Johannes Vermeer',
    incorrectAnswers: ['Rembrandt', 'Frans Hals', 'Jan Steen'],
    difficulty: 'medium'
  },
  {
    id: 'art_9',
    category: 'ART',
    question: 'What Japanese print artist created "The Great Wave off Kanagawa"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/640px-Tsunami_by_hokusai_19th_century.jpg',
    correctAnswer: 'Hokusai',
    incorrectAnswers: ['Hiroshige', 'Utamaro', 'Yoshitoshi'],
    difficulty: 'medium'
  },
  {
    id: 'art_10',
    category: 'ART',
    question: 'Who wrote the classic Russian novel "War and Peace"?',
    correctAnswer: 'Leo Tolstoy',
    incorrectAnswers: ['Fyodor Dostoevsky', 'Anton Chekhov', 'Ivan Turgenev'],
    difficulty: 'medium'
  },
  {
    id: 'art_11',
    category: 'ART',
    question: 'Which Spanish artist co-founded the Cubist art movement and painted "Guernica"?',
    correctAnswer: 'Pablo Picasso',
    incorrectAnswers: ['Diego Velázquez', 'Francisco Goya', 'Joan Miró'],
    difficulty: 'easy'
  },
  {
    id: 'art_12',
    category: 'ART',
    question: 'Which Mexican painter is celebrated for her colorful and intensely emotional self-portraits?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Frida_Kahlo%2C_by_Guillermo_Kahlo.jpg/480px-Frida_Kahlo%2C_by_Guillermo_Kahlo.jpg',
    correctAnswer: 'Frida Kahlo',
    incorrectAnswers: ['Georgia O\'Keeffe', 'Mary Cassatt', 'Leonora Carrington'],
    difficulty: 'easy'
  },
  {
    id: 'art_13',
    category: 'ART',
    question: 'What is the title of the famous epic poem by Homer recounting the journey home of Odysseus?',
    correctAnswer: 'The Odyssey',
    incorrectAnswers: ['The Iliad', 'The Aeneid', 'The Metamorphoses'],
    difficulty: 'easy'
  },
  {
    id: 'art_14',
    category: 'ART',
    question: 'Who painted the famous ceiling frescoes of the Sistine Chapel in the Vatican?',
    correctAnswer: 'Michelangelo',
    incorrectAnswers: ['Leonardo da Vinci', 'Raphael', 'Botticelli'],
    difficulty: 'easy'
  },
  {
    id: 'art_15',
    category: 'ART',
    question: 'Which French artist painted "Impression, Sunrise", which gave Impressionism its name?',
    correctAnswer: 'Claude Monet',
    incorrectAnswers: ['Édouard Manet', 'Pierre-Auguste Renoir', 'Camille Pissarro'],
    difficulty: 'medium'
  },
  {
    id: 'art_16',
    category: 'ART',
    question: 'Who wrote the Gothic horror classic "Frankenstein; or, The Modern Prometheus"?',
    correctAnswer: 'Mary Shelley',
    incorrectAnswers: ['Bram Stoker', 'Edgar Allan Poe', 'Lord Byron'],
    difficulty: 'medium'
  },
  {
    id: 'art_17',
    category: 'ART',
    question: 'Which American artist was the pioneer of Pop Art known for his Campbell\'s Soup Cans?',
    correctAnswer: 'Andy Warhol',
    incorrectAnswers: ['Roy Lichtenstein', 'Keith Haring', 'Jackson Pollock'],
    difficulty: 'easy'
  },
  {
    id: 'art_18',
    category: 'ART',
    question: 'Who sculpted the famous bronze statue "The Thinker" (Le Penseur)?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/The_Thinker_Musee_Rodin_Dec_2007.jpg/480px-The_Thinker_Musee_Rodin_Dec_2007.jpg',
    correctAnswer: 'Auguste Rodin',
    incorrectAnswers: ['Constantin Brâncuși', 'Alberto Giacometti', 'Camille Claudel'],
    difficulty: 'medium'
  },
  {
    id: 'art_19',
    category: 'ART',
    question: 'Who wrote the gothic poem "The Raven", featuring the line "Quoth the Raven \'Nevermore\'"?',
    correctAnswer: 'Edgar Allan Poe',
    incorrectAnswers: ['Walt Whitman', 'Emily Dickinson', 'H.P. Lovecraft'],
    difficulty: 'easy'
  },
  {
    id: 'art_20',
    category: 'ART',
    question: 'Which Austrian Symbolist painter created the golden masterpiece "The Kiss"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/480px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
    correctAnswer: 'Gustav Klimt',
    incorrectAnswers: ['Egon Schiele', 'Oskar Kokoschka', 'Alphonse Mucha'],
    difficulty: 'medium'
  },
  {
    id: 'art_21',
    category: 'ART',
    question: 'Which American author wrote "The Great Gatsby"?',
    correctAnswer: 'F. Scott Fitzgerald',
    incorrectAnswers: ['Ernest Hemingway', 'John Steinbeck', 'William Faulkner'],
    difficulty: 'easy'
  },
  {
    id: 'art_22',
    category: 'ART',
    question: 'Who painted the massive baroque group portrait known as "The Night Watch"?',
    correctAnswer: 'Rembrandt',
    incorrectAnswers: ['Peter Paul Rubens', 'Anthony van Dyck', 'Frans Hals'],
    difficulty: 'medium'
  },
  {
    id: 'art_23',
    category: 'ART',
    question: 'Which 19th-century French author wrote "Les Misérables" and "The Hunchback of Notre-Dame"?',
    correctAnswer: 'Victor Hugo',
    incorrectAnswers: ['Alexandre Dumas', 'Gustave Flaubert', 'Émile Zola'],
    difficulty: 'easy'
  },
  {
    id: 'art_24',
    category: 'ART',
    question: 'Which Italian artist painted the famous early Renaissance work "The Birth of Venus"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/640px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
    correctAnswer: 'Sandro Botticelli',
    incorrectAnswers: ['Titian', 'Fra Angelico', 'Caravaggio'],
    difficulty: 'medium'
  },
  {
    id: 'art_25',
    category: 'ART',
    question: 'Who authored the beloved fantasy novel series "The Lord of the Rings"?',
    correctAnswer: 'J.R.R. Tolkien',
    incorrectAnswers: ['C.S. Lewis', 'George R.R. Martin', 'Philip Pullman'],
    difficulty: 'easy'
  },
  {
    id: 'art_26',
    category: 'ART',
    question: 'What art technique involves painting directly onto fresh, wet lime plaster?',
    correctAnswer: 'Fresco',
    incorrectAnswers: ['Gouache', 'Encaustic', 'Chiaroscuro'],
    difficulty: 'hard'
  },
  {
    id: 'art_27',
    category: 'ART',
    question: 'Who wrote the classic novel "Pride and Prejudice"?',
    correctAnswer: 'Jane Austen',
    incorrectAnswers: ['Charlotte Brontë', 'Emily Brontë', 'George Eliot'],
    difficulty: 'easy'
  },
  {
    id: 'art_28',
    category: 'ART',
    question: 'Which American painter was famous for his "drip technique" in abstract expressionism?',
    correctAnswer: 'Jackson Pollock',
    incorrectAnswers: ['Mark Rothko', 'Willem de Kooning', 'Franz Kline'],
    difficulty: 'medium'
  },
  {
    id: 'art_29',
    category: 'ART',
    question: 'Who wrote "Don Quixote", often considered the first modern novel?',
    correctAnswer: 'Miguel de Cervantes',
    incorrectAnswers: ['Gabriel García Márquez', 'Federico García Lorca', 'Jorge Luis Borges'],
    difficulty: 'easy'
  },
  {
    id: 'art_30',
    category: 'ART',
    question: 'Which Renaissance artist painted "The School of Athens" inside the Apostolic Palace in the Vatican?',
    correctAnswer: 'Raphael',
    incorrectAnswers: ['Michelangelo', 'Leonardo da Vinci', 'Caravaggio'],
    difficulty: 'hard'
  },

  // ==========================================
  // SCIENCE & NATURE (30 questions)
  // ==========================================
  {
    id: 'sci_1',
    category: 'SCIENCE',
    question: 'What is the chemical symbol for the element Gold?',
    correctAnswer: 'Au',
    incorrectAnswers: ['Ag', 'Fe', 'Gd'],
    difficulty: 'easy'
  },
  {
    id: 'sci_2',
    category: 'SCIENCE',
    question: 'Which celestial body in our solar system is known as the "Red Planet"?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/480px-OSIRIS_Mars_true_color.jpg',
    correctAnswer: 'Mars',
    incorrectAnswers: ['Venus', 'Jupiter', 'Mercury'],
    difficulty: 'easy'
  },
  {
    id: 'sci_3',
    category: 'SCIENCE',
    question: 'What is the powerhouse organelle of eukaryotic cells responsible for producing ATP?',
    correctAnswer: 'Mitochondria',
    incorrectAnswers: ['Ribosome', 'Endoplasmic Reticulum', 'Golgi Apparatus'],
    difficulty: 'easy'
  },
  {
    id: 'sci_4',
    category: 'SCIENCE',
    question: 'What is the speed of light in vacuum approximately equal to?',
    correctAnswer: '300,000 km/s',
    incorrectAnswers: ['150,000 km/s', '1,000,000 km/s', '30,000 km/s'],
    difficulty: 'medium'
  },
  {
    id: 'sci_5',
    category: 'SCIENCE',
    question: 'Which gas makes up the largest percentage of Earth\'s atmosphere (approximately 78%)?',
    correctAnswer: 'Nitrogen',
    incorrectAnswers: ['Oxygen', 'Carbon Dioxide', 'Argon'],
    difficulty: 'easy'
  },
  {
    id: 'sci_6',
    category: 'SCIENCE',
    question: 'What is the largest living species of mammal on Earth?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Anim1756_-_Flickr_-_NOAA_Photo_Library.jpg/640px-Anim1756_-_Flickr_-_NOAA_Photo_Library.jpg',
    correctAnswer: 'Blue Whale',
    incorrectAnswers: ['African Elephant', 'Sperm Whale', 'Colossal Squid'],
    difficulty: 'easy'
  },
  {
    id: 'sci_7',
    category: 'SCIENCE',
    question: 'Who formulated the three fundamental laws of classical motion and universal gravitation?',
    correctAnswer: 'Sir Isaac Newton',
    incorrectAnswers: ['Albert Einstein', 'Galileo Galilei', 'Niels Bohr'],
    difficulty: 'easy'
  },
  {
    id: 'sci_8',
    category: 'SCIENCE',
    question: 'What is the hardest naturally occurring mineral on Mohs hardness scale?',
    correctAnswer: 'Diamond',
    incorrectAnswers: ['Corundum', 'Topaz', 'Quartz'],
    difficulty: 'easy'
  },
  {
    id: 'sci_9',
    category: 'SCIENCE',
    question: 'Which planet in our solar system has the most prominent and extensive ring system?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/640px-Saturn_during_Equinox.jpg',
    correctAnswer: 'Saturn',
    incorrectAnswers: ['Jupiter', 'Uranus', 'Neptune'],
    difficulty: 'easy'
  },
  {
    id: 'sci_10',
    category: 'SCIENCE',
    question: 'What is the pH level of pure distilled water at 25°C?',
    correctAnswer: '7',
    incorrectAnswers: ['0', '5', '9'],
    difficulty: 'easy'
  },
  {
    id: 'sci_11',
    category: 'SCIENCE',
    question: 'What is the name of the particle that carries the strong nuclear force binding quarks together?',
    correctAnswer: 'Gluon',
    incorrectAnswers: ['Photon', 'W Boson', 'Higgs Boson'],
    difficulty: 'hard'
  },
  {
    id: 'sci_12',
    category: 'SCIENCE',
    question: 'What is the primary green pigment in plants that absorbs light during photosynthesis?',
    correctAnswer: 'Chlorophyll',
    incorrectAnswers: ['Carotenoid', 'Anthocyanin', 'Melanin'],
    difficulty: 'easy'
  },
  {
    id: 'sci_13',
    category: 'SCIENCE',
    question: 'What astronomical event occurred in 1969 with the Apollo 11 mission?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Buzz_salutes_the_U.S._Flag.jpg/480px-Buzz_salutes_the_U.S._Flag.jpg',
    correctAnswer: 'First humans walked on the Moon',
    incorrectAnswers: ['First satellite launched', 'First spacewalk', 'First orbit of Venus'],
    difficulty: 'easy'
  },
  {
    id: 'sci_14',
    category: 'SCIENCE',
    question: 'How many bones are in the average adult human skeleton?',
    correctAnswer: '206',
    incorrectAnswers: ['184', '224', '300'],
    difficulty: 'medium'
  },
  {
    id: 'sci_15',
    category: 'SCIENCE',
    question: 'What is the SI unit of electrical resistance?',
    correctAnswer: 'Ohm',
    incorrectAnswers: ['Volt', 'Ampere', 'Watt'],
    difficulty: 'medium'
  },
  {
    id: 'sci_16',
    category: 'SCIENCE',
    question: 'Which scientist proposed the theory of evolution by natural selection in "On the Origin of Species"?',
    correctAnswer: 'Charles Darwin',
    incorrectAnswers: ['Gregor Mendel', 'Jean-Baptiste Lamarck', 'Alfred Russel Wallace'],
    difficulty: 'easy'
  },
  {
    id: 'sci_17',
    category: 'SCIENCE',
    question: 'What is the name of the brightest star visible from Earth in the night sky?',
    correctAnswer: 'Sirius',
    incorrectAnswers: ['Betelgeuse', 'Polaris', 'Vega'],
    difficulty: 'medium'
  },
  {
    id: 'sci_18',
    category: 'SCIENCE',
    question: 'Which blood type is considered the universal red blood cell donor in humans?',
    correctAnswer: 'O negative',
    incorrectAnswers: ['AB positive', 'A positive', 'B negative'],
    difficulty: 'medium'
  },
  {
    id: 'sci_19',
    category: 'SCIENCE',
    question: 'What type of eclipse occurs when the Moon passes directly between the Sun and Earth?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Solar_eclipse_1999_4_NR.jpg/480px-Solar_eclipse_1999_4_NR.jpg',
    correctAnswer: 'Solar Eclipse',
    incorrectAnswers: ['Lunar Eclipse', 'Stellar Eclipse', 'Planetary Transit'],
    difficulty: 'easy'
  },
  {
    id: 'sci_20',
    category: 'SCIENCE',
    question: 'What is the boiling point of pure water at standard atmospheric pressure in Celsius?',
    correctAnswer: '100°C',
    incorrectAnswers: ['90°C', '120°C', '212°C'],
    difficulty: 'easy'
  },
  {
    id: 'sci_21',
    category: 'SCIENCE',
    question: 'What is the common term for the medical condition known as hypertension?',
    correctAnswer: 'High blood pressure',
    incorrectAnswers: ['High blood sugar', 'Elevated cholesterol', 'Irregular heartbeat'],
    difficulty: 'easy'
  },
  {
    id: 'sci_22',
    category: 'SCIENCE',
    question: 'What is the most abundant chemical element in the universe by mass?',
    correctAnswer: 'Hydrogen',
    incorrectAnswers: ['Helium', 'Carbon', 'Oxygen'],
    difficulty: 'easy'
  },
  {
    id: 'sci_23',
    category: 'SCIENCE',
    question: 'Which instrument is used to measure atmospheric air pressure?',
    correctAnswer: 'Barometer',
    incorrectAnswers: ['Anemometer', 'Hygrometer', 'Thermometer'],
    difficulty: 'medium'
  },
  {
    id: 'sci_24',
    category: 'SCIENCE',
    question: 'Which structure in a cell contains the organism\'s genetic code (DNA)?',
    correctAnswer: 'Nucleus',
    incorrectAnswers: ['Cytoplasm', 'Lysosome', 'Vacuole'],
    difficulty: 'easy'
  },
  {
    id: 'sci_25',
    category: 'SCIENCE',
    question: 'What is the process called when a solid turns directly into a gas without melting?',
    correctAnswer: 'Sublimation',
    incorrectAnswers: ['Condensation', 'Deposition', 'Evaporation'],
    difficulty: 'medium'
  },
  {
    id: 'sci_26',
    category: 'SCIENCE',
    question: 'Who developed the Polio vaccine in the 1950s that saved millions from paralysis?',
    correctAnswer: 'Jonas Salk',
    incorrectAnswers: ['Alexander Fleming', 'Louis Pasteur', 'Edward Jenner'],
    difficulty: 'medium'
  },
  {
    id: 'sci_27',
    category: 'SCIENCE',
    question: 'What is the study of fossils and prehistoric life called?',
    correctAnswer: 'Paleontology',
    incorrectAnswers: ['Archaeology', 'Anthropology', 'Geology'],
    difficulty: 'easy'
  },
  {
    id: 'sci_28',
    category: 'SCIENCE',
    question: 'What is the deepest known location in Earth\'s oceans?',
    correctAnswer: 'Mariana Trench (Challenger Deep)',
    incorrectAnswers: ['Puerto Rico Trench', 'Java Trench', 'Tonga Trench'],
    difficulty: 'medium'
  },
  {
    id: 'sci_29',
    category: 'SCIENCE',
    question: 'What subatomic particle has no electric charge?',
    correctAnswer: 'Neutron',
    incorrectAnswers: ['Proton', 'Electron', 'Positron'],
    difficulty: 'easy'
  },
  {
    id: 'sci_30',
    category: 'SCIENCE',
    question: 'What is absolute zero temperature in Celsius?',
    correctAnswer: '-273.15°C',
    incorrectAnswers: ['0°C', '-100°C', '-459.67°C'],
    difficulty: 'medium'
  },

  // ==========================================
  // SPORTS & GAMES (30 questions)
  // ==========================================
  {
    id: 'spo_1',
    category: 'SPORTS',
    question: 'In soccer (football), how many players per team are on the pitch at kickoff?',
    correctAnswer: '11',
    incorrectAnswers: ['10', '12', '9'],
    difficulty: 'easy'
  },
  {
    id: 'spo_2',
    category: 'SPORTS',
    question: 'Which country won the FIFA Men\'s World Cup in 2022 held in Qatar?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_Argentina.svg/640px-Flag_of_Argentina.svg.png',
    correctAnswer: 'Argentina',
    incorrectAnswers: ['France', 'Brazil', 'Croatia'],
    difficulty: 'easy'
  },
  {
    id: 'spo_3',
    category: 'SPORTS',
    question: 'How many points is a touchdown worth in American football (NFL)?',
    correctAnswer: '6',
    incorrectAnswers: ['7', '3', '8'],
    difficulty: 'easy'
  },
  {
    id: 'spo_4',
    category: 'SPORTS',
    question: 'In tennis, what specific word denotes a score of zero points in a game?',
    correctAnswer: 'Love',
    incorrectAnswers: ['Deuce', 'Fault', 'Nil'],
    difficulty: 'easy'
  },
  {
    id: 'spo_5',
    category: 'SPORTS',
    question: 'How many rings are featured on the official Olympic flag?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Olympic_rings_without_rims.svg/640px-Olympic_rings_without_rims.svg.png',
    correctAnswer: '5',
    incorrectAnswers: ['6', '4', '7'],
    difficulty: 'easy'
  },
  {
    id: 'spo_6',
    category: 'SPORTS',
    question: 'What is the maximum break possible in a standard frame of snooker without fouls?',
    correctAnswer: '147',
    incorrectAnswers: ['155', '140', '150'],
    difficulty: 'hard'
  },
  {
    id: 'spo_7',
    category: 'SPORTS',
    question: 'Who holds the world record for the 100m sprint with a time of 9.58 seconds?',
    correctAnswer: 'Usain Bolt',
    incorrectAnswers: ['Tyson Gay', 'Yohan Blake', 'Carl Lewis'],
    difficulty: 'easy'
  },
  {
    id: 'spo_8',
    category: 'SPORTS',
    question: 'In basketball, what is the official height of the rim above the court floor?',
    correctAnswer: '10 feet (3.05 meters)',
    incorrectAnswers: ['9.5 feet', '11 feet', '10.5 feet'],
    difficulty: 'easy'
  },
  {
    id: 'spo_9',
    category: 'SPORTS',
    question: 'Which legendary boxer was known as "The Greatest" and used the phrase "float like a butterfly, sting like a bee"?',
    correctAnswer: 'Muhammad Ali',
    incorrectAnswers: ['Mike Tyson', 'George Foreman', 'Joe Frazier'],
    difficulty: 'easy'
  },
  {
    id: 'spo_10',
    category: 'SPORTS',
    question: 'What is the official distance of a standard marathon road race?',
    correctAnswer: '26.2 miles (42.195 km)',
    incorrectAnswers: ['25 miles (40 km)', '30 miles (48.3 km)', '20 miles (32.2 km)'],
    difficulty: 'easy'
  },
  {
    id: 'spo_11',
    category: 'SPORTS',
    question: 'In bowling, what term refers to knocking down all 10 pins with your first roll?',
    correctAnswer: 'Strike',
    incorrectAnswers: ['Spare', 'Turkey', 'Split'],
    difficulty: 'easy'
  },
  {
    id: 'spo_12',
    category: 'SPORTS',
    question: 'Which Formula 1 driver has won a joint-record 7 World Drivers\' Championships alongside Michael Schumacher?',
    correctAnswer: 'Lewis Hamilton',
    incorrectAnswers: ['Max Verstappen', 'Sebastian Vettel', 'Fernando Alonso'],
    difficulty: 'medium'
  },
  {
    id: 'spo_13',
    category: 'SPORTS',
    question: 'What Grand Slam tennis tournament is played exclusively on outdoor grass courts?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Wimbledon.svg/480px-Wimbledon.svg.png',
    correctAnswer: 'Wimbledon',
    incorrectAnswers: ['Roland-Garros (French Open)', 'US Open', 'Australian Open'],
    difficulty: 'easy'
  },
  {
    id: 'spo_14',
    category: 'SPORTS',
    question: 'In baseball, how many strikes constitute an out for the batter?',
    correctAnswer: '3',
    incorrectAnswers: ['4', '2', '5'],
    difficulty: 'easy'
  },
  {
    id: 'spo_15',
    category: 'SPORTS',
    question: 'Which country invented the modern sport of curling?',
    correctAnswer: 'Scotland',
    incorrectAnswers: ['Canada', 'Norway', 'Sweden'],
    difficulty: 'medium'
  },
  {
    id: 'spo_16',
    category: 'SPORTS',
    question: 'In golf, what term describes scoring two strokes under par on a single hole?',
    correctAnswer: 'Eagle',
    incorrectAnswers: ['Birdie', 'Albatross', 'Bogey'],
    difficulty: 'medium'
  },
  {
    id: 'spo_17',
    category: 'SPORTS',
    question: 'Which NBA player scored a historic 100 points in a single game in 1962?',
    correctAnswer: 'Wilt Chamberlain',
    incorrectAnswers: ['Michael Jordan', 'Kobe Bryant', 'Kareem Abdul-Jabbar'],
    difficulty: 'medium'
  },
  {
    id: 'spo_18',
    category: 'SPORTS',
    question: 'How many players are on the ice for each team during standard NHL regulation play (including goalie)?',
    correctAnswer: '6',
    incorrectAnswers: ['5', '7', '8'],
    difficulty: 'easy'
  },
  {
    id: 'spo_19',
    category: 'SPORTS',
    question: 'In chess, which piece can move only diagonally on squares of its starting color?',
    correctAnswer: 'Bishop',
    incorrectAnswers: ['Knight', 'Rook', 'Pawn'],
    difficulty: 'easy'
  },
  {
    id: 'spo_20',
    category: 'SPORTS',
    question: 'Which country hosted the 2016 Summer Olympic Games in Rio de Janeiro?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Flag_of_Brazil.svg/640px-Flag_of_Brazil.svg.png',
    correctAnswer: 'Brazil',
    incorrectAnswers: ['Spain', 'China', 'United Kingdom'],
    difficulty: 'easy'
  },
  {
    id: 'spo_21',
    category: 'SPORTS',
    question: 'What is the national sport of Japan involving ceremonial wrestling in a circular ring?',
    correctAnswer: 'Sumo Wrestling',
    incorrectAnswers: ['Judo', 'Karate', 'Kendo'],
    difficulty: 'easy'
  },
  {
    id: 'spo_22',
    category: 'SPORTS',
    question: 'In rugby union, how many points is an uncontested try worth?',
    correctAnswer: '5',
    incorrectAnswers: ['3', '4', '6'],
    difficulty: 'medium'
  },
  {
    id: 'spo_23',
    category: 'SPORTS',
    question: 'Who won 23 Olympic gold medals in swimming, the most in Olympic history?',
    correctAnswer: 'Michael Phelps',
    incorrectAnswers: ['Ryan Lochte', 'Ian Thorpe', 'Mark Spitz'],
    difficulty: 'easy'
  },
  {
    id: 'spo_24',
    category: 'SPORTS',
    question: 'Which team won the 2024 UEFA Champions League final?',
    correctAnswer: 'Real Madrid',
    incorrectAnswers: ['Borussia Dortmund', 'Manchester City', 'Bayern Munich'],
    difficulty: 'medium'
  },
  {
    id: 'spo_25',
    category: 'SPORTS',
    question: 'In cricket, how many balls make up one standard over?',
    correctAnswer: '6',
    incorrectAnswers: ['8', '5', '10'],
    difficulty: 'easy'
  },
  {
    id: 'spo_26',
    category: 'SPORTS',
    question: 'What color jersey is worn by the overall leader in the Tour de France cycling race?',
    correctAnswer: 'Yellow',
    incorrectAnswers: ['Green', 'Polka Dot', 'White'],
    difficulty: 'easy'
  },
  {
    id: 'spo_27',
    category: 'SPORTS',
    question: 'In table tennis (ping pong), how many points are needed to win a modern regulation game (must lead by 2)?',
    correctAnswer: '11',
    incorrectAnswers: ['21', '15', '25'],
    difficulty: 'medium'
  },
  {
    id: 'spo_28',
    category: 'SPORTS',
    question: 'What is the diameter of an official basketball rim in inches?',
    correctAnswer: '18 inches',
    incorrectAnswers: ['16 inches', '20 inches', '22 inches'],
    difficulty: 'hard'
  },
  {
    id: 'spo_29',
    category: 'SPORTS',
    question: 'Which country won the inaugural FIFA Men\'s World Cup tournament in 1930?',
    correctAnswer: 'Uruguay',
    incorrectAnswers: ['Argentina', 'Italy', 'Brazil'],
    difficulty: 'hard'
  },
  {
    id: 'spo_30',
    category: 'SPORTS',
    question: 'What martial art originated in Korea and is known for its emphasis on head-height kicks?',
    correctAnswer: 'Taekwondo',
    incorrectAnswers: ['Judo', 'Muay Thai', 'Aikido'],
    difficulty: 'easy'
  },

  // ==========================================
  // ENTERTAINMENT & POP CULTURE (30 questions)
  // ==========================================
  {
    id: 'ent_1',
    category: 'ENTERTAINMENT',
    question: 'Which movie won the Academy Award for Best Picture at the Oscars in 2024?',
    correctAnswer: 'Oppenheimer',
    incorrectAnswers: ['Barbie', 'Poor Things', 'Killers of the Flower Moon'],
    difficulty: 'medium'
  },
  {
    id: 'ent_2',
    category: 'ENTERTAINMENT',
    question: 'Who played the iconic character Jack Sparrow in "Pirates of the Caribbean"?',
    correctAnswer: 'Johnny Depp',
    incorrectAnswers: ['Orlando Bloom', 'Geoffrey Rush', 'Keanu Reeves'],
    difficulty: 'easy'
  },
  {
    id: 'ent_3',
    category: 'ENTERTAINMENT',
    question: 'What is the highest-grossing film of all time worldwide (unadjusted for inflation)?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/Avatar_%282009_film%29_poster.jpg/480px-Avatar_%282009_film%29_poster.jpg',
    correctAnswer: 'Avatar',
    incorrectAnswers: ['Avengers: Endgame', 'Titanic', 'Star Wars: The Force Awakens'],
    difficulty: 'easy'
  },
  {
    id: 'ent_4',
    category: 'ENTERTAINMENT',
    question: 'Which British rock band released the albums "Abbey Road", "Revolver", and "Sgt. Pepper"?',
    correctAnswer: 'The Beatles',
    incorrectAnswers: ['The Rolling Stones', 'Pink Floyd', 'Led Zeppelin'],
    difficulty: 'easy'
  },
  {
    id: 'ent_5',
    category: 'ENTERTAINMENT',
    question: 'Who created and starred in the hit Broadway musical "Hamilton"?',
    correctAnswer: 'Lin-Manuel Miranda',
    incorrectAnswers: ['Ben Platt', 'Idina Menzel', 'Jonathan Groff'],
    difficulty: 'easy'
  },
  {
    id: 'ent_6',
    category: 'ENTERTAINMENT',
    question: 'In "The Lord of the Rings" films directed by Peter Jackson, which actor portrayed Frodo Baggins?',
    correctAnswer: 'Elijah Wood',
    incorrectAnswers: ['Daniel Radcliffe', 'Sean Astin', 'Dominic Monaghan'],
    difficulty: 'easy'
  },
  {
    id: 'ent_7',
    category: 'ENTERTAINMENT',
    question: 'What is the fictional continent where the majority of "Game of Thrones" takes place?',
    correctAnswer: 'Westeros',
    incorrectAnswers: ['Essos', 'Sothoryos', 'Middle-earth'],
    difficulty: 'easy'
  },
  {
    id: 'ent_8',
    category: 'ENTERTAINMENT',
    question: 'Who is the famous pop artist known as the "King of Pop" who sang "Thriller" and "Billie Jean"?',
    correctAnswer: 'Michael Jackson',
    incorrectAnswers: ['Prince', 'Stevie Wonder', 'George Michael'],
    difficulty: 'easy'
  },
  {
    id: 'ent_9',
    category: 'ENTERTAINMENT',
    question: 'What video game features a mustachioed Italian plumber jumping on mushrooms to save Princess Peach?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/Super_Mario_Bros._box.png/480px-Super_Mario_Bros._box.png',
    correctAnswer: 'Super Mario Bros.',
    incorrectAnswers: ['Sonic the Hedgehog', 'The Legend of Zelda', 'Donkey Kong'],
    difficulty: 'easy'
  },
  {
    id: 'ent_10',
    category: 'ENTERTAINMENT',
    question: 'Which actress portrayed Katniss Everdeen in "The Hunger Games" film series?',
    correctAnswer: 'Jennifer Lawrence',
    incorrectAnswers: ['Emma Stone', 'Kristen Stewart', 'Shailene Woodley'],
    difficulty: 'easy'
  },
  {
    id: 'ent_11',
    category: 'ENTERTAINMENT',
    question: 'Who directed the sci-fi masterpieces "Inception", "Interstellar", and the "Dark Knight" trilogy?',
    correctAnswer: 'Christopher Nolan',
    incorrectAnswers: ['Steven Spielberg', 'Denis Villeneuve', 'James Cameron'],
    difficulty: 'easy'
  },
  {
    id: 'ent_12',
    category: 'ENTERTAINMENT',
    question: 'In the sitcom "Friends", what is Chandler Bing\'s middle name?',
    correctAnswer: 'Muriel',
    incorrectAnswers: ['Francis', 'Eustace', 'Arthur'],
    difficulty: 'hard'
  },
  {
    id: 'ent_13',
    category: 'ENTERTAINMENT',
    question: 'What is the name of the protagonist in Nintendo\'s "The Legend of Zelda" video game franchise?',
    correctAnswer: 'Link',
    incorrectAnswers: ['Zelda', 'Ganon', 'Epona'],
    difficulty: 'easy'
  },
  {
    id: 'ent_14',
    category: 'ENTERTAINMENT',
    question: 'Which animated movie features the hit song "Let It Go" sung by Idina Menzel?',
    correctAnswer: 'Frozen',
    incorrectAnswers: ['Tangled', 'Moana', 'Brave'],
    difficulty: 'easy'
  },
  {
    id: 'ent_15',
    category: 'ENTERTAINMENT',
    question: 'Who played Walter White, a high school chemistry teacher turned meth kingpin, in "Breaking Bad"?',
    correctAnswer: 'Bryan Cranston',
    incorrectAnswers: ['Aaron Paul', 'Bob Odenkirk', 'Giancarlo Esposito'],
    difficulty: 'easy'
  },
  {
    id: 'ent_16',
    category: 'ENTERTAINMENT',
    question: 'Which music artist holds the record for the most Grammy Awards won in history (32 Grammys)?',
    correctAnswer: 'Beyoncé',
    incorrectAnswers: ['Taylor Swift', 'Aretha Franklin', 'Adele'],
    difficulty: 'medium'
  },
  {
    id: 'ent_17',
    category: 'ENTERTAINMENT',
    question: 'In "Star Wars: The Empire Strikes Back", what shocking revelation does Darth Vader deliver to Luke Skywalker?',
    correctAnswer: '"I am your father"',
    incorrectAnswers: ['"I am your brother"', '"Obi-Wan killed your mother"', '"The Emperor is your master"'],
    difficulty: 'easy'
  },
  {
    id: 'ent_18',
    category: 'ENTERTAINMENT',
    question: 'What is the fictional paper company where characters work in the US comedy "The Office"?',
    correctAnswer: 'Dunder Mifflin',
    incorrectAnswers: ['Wernham Hogg', 'Initech', 'Sabre Paper'],
    difficulty: 'easy'
  },
  {
    id: 'ent_19',
    category: 'ENTERTAINMENT',
    question: 'What bestselling album by Fleetwood Mac was released in 1977 featuring "Dreams" and "Go Your Own Way"?',
    correctAnswer: 'Rumours',
    incorrectAnswers: ['Tusk', 'Mirage', 'Tango in the Night'],
    difficulty: 'medium'
  },
  {
    id: 'ent_20',
    category: 'ENTERTAINMENT',
    question: 'Which character did Robert Downey Jr. play for over a decade in the Marvel Cinematic Universe?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/00/Iron_Man_poster.jpg/480px-Iron_Man_poster.jpg',
    correctAnswer: 'Tony Stark / Iron Man',
    incorrectAnswers: ['Steve Rogers / Captain America', 'Bruce Banner / Hulk', 'Doctor Strange'],
    difficulty: 'easy'
  },
  {
    id: 'ent_21',
    category: 'ENTERTAINMENT',
    question: 'What is the longest-running scripted primetime TV series in American television history?',
    correctAnswer: 'The Simpsons',
    incorrectAnswers: ['South Park', 'Family Guy', 'Law & Order'],
    difficulty: 'easy'
  },
  {
    id: 'ent_22',
    category: 'ENTERTAINMENT',
    question: 'Who composed the unforgettable musical scores for "Jaws", "Star Wars", "Indiana Jones", and "Jurassic Park"?',
    correctAnswer: 'John Williams',
    incorrectAnswers: ['Hans Zimmer', 'Ennio Morricone', 'Danny Elfman'],
    difficulty: 'easy'
  },
  {
    id: 'ent_23',
    category: 'ENTERTAINMENT',
    question: 'In "Harry Potter", what house at Hogwarts is represented by a badger and the colors yellow and black?',
    correctAnswer: 'Hufflepuff',
    incorrectAnswers: ['Ravenclaw', 'Gryffindor', 'Slytherin'],
    difficulty: 'medium'
  },
  {
    id: 'ent_24',
    category: 'ENTERTAINMENT',
    question: 'What is the title of Quentin Tarantino\'s 1994 cult classic crime film starring John Travolta and Samuel L. Jackson?',
    correctAnswer: 'Pulp Fiction',
    incorrectAnswers: ['Reservoir Dogs', 'Jackie Brown', 'Kill Bill'],
    difficulty: 'easy'
  },
  {
    id: 'ent_25',
    category: 'ENTERTAINMENT',
    question: 'Which pop superstar embarked on the record-shattering "Eras Tour" in 2023-2024?',
    correctAnswer: 'Taylor Swift',
    incorrectAnswers: ['Ariana Grande', 'Billie Eilish', 'Dua Lipa'],
    difficulty: 'easy'
  },
  {
    id: 'ent_26',
    category: 'ENTERTAINMENT',
    question: 'Which company developed and published the smash-hit battle royale game "Fortnite"?',
    correctAnswer: 'Epic Games',
    incorrectAnswers: ['Riot Games', 'Valve', 'Activision Blizzard'],
    difficulty: 'easy'
  },
  {
    id: 'ent_27',
    category: 'ENTERTAINMENT',
    question: 'Who won the first season of "American Idol" in 2002?',
    correctAnswer: 'Kelly Clarkson',
    incorrectAnswers: ['Carrie Underwood', 'Clay Aiken', 'Jennifer Hudson'],
    difficulty: 'medium'
  },
  {
    id: 'ent_28',
    category: 'ENTERTAINMENT',
    question: 'What is the name of the fictional kingdom ruled by T\'Challa in Marvel\'s "Black Panther"?',
    correctAnswer: 'Wakanda',
    incorrectAnswers: ['Genosha', 'Latveria', 'Zamunda'],
    difficulty: 'easy'
  },
  {
    id: 'ent_29',
    category: 'ENTERTAINMENT',
    question: 'What iconic electronic music duo performed in futuristic robot helmets until their split in 2021?',
    correctAnswer: 'Daft Punk',
    incorrectAnswers: ['Justice', 'The Chemical Brothers', 'Kraftwerk'],
    difficulty: 'easy'
  },
  {
    id: 'ent_30',
    category: 'ENTERTAINMENT',
    question: 'In "The Matrix", what color pill does Morpheus offer Neo to learn the truth about reality?',
    correctAnswer: 'Red',
    incorrectAnswers: ['Blue', 'Green', 'Yellow'],
    difficulty: 'easy'
  },

  // ==========================================
  // GEOGRAPHY & TRAVEL (30 questions)
  // ==========================================
  {
    id: 'geo_1',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Australia?',
    correctAnswer: 'Canberra',
    incorrectAnswers: ['Sydney', 'Melbourne', 'Brisbane'],
    difficulty: 'medium'
  },
  {
    id: 'geo_2',
    category: 'GEOGRAPHY',
    question: 'Which country does this iconic national flag belong to?',
    imageUrl: 'https://flagcdn.com/w640/ca.png',
    correctAnswer: 'Canada',
    incorrectAnswers: ['Switzerland', 'Denmark', 'Austria'],
    difficulty: 'easy'
  },
  {
    id: 'geo_3',
    category: 'GEOGRAPHY',
    question: 'What is the longest river in the world by general consensus?',
    correctAnswer: 'Nile River',
    incorrectAnswers: ['Amazon River', 'Yangtze River', 'Mississippi River'],
    difficulty: 'easy'
  },
  {
    id: 'geo_4',
    category: 'GEOGRAPHY',
    question: 'In which European city is this famous ancient amphitheater, the Colosseum, located?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/640px-Colosseo_2020.jpg',
    correctAnswer: 'Rome, Italy',
    incorrectAnswers: ['Athens, Greece', 'Madrid, Spain', 'Florence, Italy'],
    difficulty: 'easy'
  },
  {
    id: 'geo_5',
    category: 'GEOGRAPHY',
    question: 'What is the largest hot desert in the world?',
    correctAnswer: 'Sahara Desert',
    incorrectAnswers: ['Gobi Desert', 'Kalahari Desert', 'Arabian Desert'],
    difficulty: 'easy'
  },
  {
    id: 'geo_6',
    category: 'GEOGRAPHY',
    question: 'What mountain is the highest peak above sea level on Earth?',
    correctAnswer: 'Mount Everest',
    incorrectAnswers: ['K2', 'Kangchenjunga', 'Kilimanjaro'],
    difficulty: 'easy'
  },
  {
    id: 'geo_7',
    category: 'GEOGRAPHY',
    question: 'Which country has the largest total land area in the world?',
    correctAnswer: 'Russia',
    incorrectAnswers: ['Canada', 'China', 'United States'],
    difficulty: 'easy'
  },
  {
    id: 'geo_8',
    category: 'GEOGRAPHY',
    question: 'Which country does this distinctive national flag belong to?',
    imageUrl: 'https://flagcdn.com/w640/jp.png',
    correctAnswer: 'Japan',
    incorrectAnswers: ['South Korea', 'Bangladesh', 'Vietnam'],
    difficulty: 'easy'
  },
  {
    id: 'geo_9',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Canada?',
    correctAnswer: 'Ottawa',
    incorrectAnswers: ['Toronto', 'Vancouver', 'Montreal'],
    difficulty: 'medium'
  },
  {
    id: 'geo_10',
    category: 'GEOGRAPHY',
    question: 'In which South American nation can you visit the ancient Inca citadel of Machu Picchu?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/640px-Machu_Picchu%2C_Peru.jpg',
    correctAnswer: 'Peru',
    incorrectAnswers: ['Chile', 'Bolivia', 'Colombia'],
    difficulty: 'easy'
  },
  {
    id: 'geo_11',
    category: 'GEOGRAPHY',
    question: 'What is the smallest independent sovereign state in the world by both area and population?',
    correctAnswer: 'Vatican City',
    incorrectAnswers: ['Monaco', 'San Marino', 'Liechtenstein'],
    difficulty: 'easy'
  },
  {
    id: 'geo_12',
    category: 'GEOGRAPHY',
    question: 'Which strait separates Europe and Africa between Spain and Morocco?',
    correctAnswer: 'Strait of Gibraltar',
    incorrectAnswers: ['Bosphorus Strait', 'Strait of Hormuz', 'Dardanelles'],
    difficulty: 'medium'
  },
  {
    id: 'geo_13',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Brazil?',
    correctAnswer: 'Brasília',
    incorrectAnswers: ['Rio de Janeiro', 'São Paulo', 'Salvador'],
    difficulty: 'medium'
  },
  {
    id: 'geo_14',
    category: 'GEOGRAPHY',
    question: 'Which country has the most natural islands in the world (over 260,000 islands)?',
    correctAnswer: 'Sweden',
    incorrectAnswers: ['Indonesia', 'Philippines', 'Norway'],
    difficulty: 'hard'
  },
  {
    id: 'geo_15',
    category: 'GEOGRAPHY',
    question: 'Which country does this distinctive flag with a golden sun on a white-and-light-blue background belong to?',
    imageUrl: 'https://flagcdn.com/w640/ar.png',
    correctAnswer: 'Argentina',
    incorrectAnswers: ['Uruguay', 'Guatemala', 'Honduras'],
    difficulty: 'easy'
  },
  {
    id: 'geo_16',
    category: 'GEOGRAPHY',
    question: 'In which country is the world-famous white marble mausoleum known as the Taj Mahal located?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/640px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg',
    correctAnswer: 'India',
    incorrectAnswers: ['Pakistan', 'Bangladesh', 'Turkey'],
    difficulty: 'easy'
  },
  {
    id: 'geo_17',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Egypt?',
    correctAnswer: 'Cairo',
    incorrectAnswers: ['Alexandria', 'Giza', 'Luxor'],
    difficulty: 'easy'
  },
  {
    id: 'geo_18',
    category: 'GEOGRAPHY',
    question: 'Which of the Great Lakes is the largest freshwater lake in the world by surface area?',
    correctAnswer: 'Lake Superior',
    incorrectAnswers: ['Lake Michigan', 'Lake Huron', 'Lake Victoria'],
    difficulty: 'medium'
  },
  {
    id: 'geo_19',
    category: 'GEOGRAPHY',
    question: 'What body of water lies between the United Kingdom and France?',
    correctAnswer: 'The English Channel',
    incorrectAnswers: ['North Sea', 'Irish Sea', 'Bay of Biscay'],
    difficulty: 'easy'
  },
  {
    id: 'geo_20',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of South Korea?',
    correctAnswer: 'Seoul',
    incorrectAnswers: ['Busan', 'Incheon', 'Daegu'],
    difficulty: 'easy'
  },
  {
    id: 'geo_21',
    category: 'GEOGRAPHY',
    question: 'Which African nation was previously known as Abyssinia and remained uncolonized during the Scramble for Africa?',
    correctAnswer: 'Ethiopia',
    incorrectAnswers: ['Kenya', 'Ghana', 'Liberia'],
    difficulty: 'medium'
  },
  {
    id: 'geo_22',
    category: 'GEOGRAPHY',
    question: 'Which country does this flag belong to, featuring a cedar tree in the center?',
    imageUrl: 'https://flagcdn.com/w640/lb.png',
    correctAnswer: 'Lebanon',
    incorrectAnswers: ['Cyprus', 'Jordan', 'Syria'],
    difficulty: 'medium'
  },
  {
    id: 'geo_23',
    category: 'GEOGRAPHY',
    question: 'What is the deepest lake in the world, holding roughly 20% of Earth\'s unfrozen surface fresh water?',
    correctAnswer: 'Lake Baikal',
    incorrectAnswers: ['Lake Tanganyika', 'Caspian Sea', 'Lake Superior'],
    difficulty: 'medium'
  },
  {
    id: 'geo_24',
    category: 'GEOGRAPHY',
    question: 'Which country is home to the fjord-indented coastline depicted in famous Scandinavian travel photos?',
    correctAnswer: 'Norway',
    incorrectAnswers: ['Finland', 'Denmark', 'Iceland'],
    difficulty: 'easy'
  },
  {
    id: 'geo_25',
    category: 'GEOGRAPHY',
    question: 'What is the highest uninterrupted waterfall in the world, located in Venezuela?',
    correctAnswer: 'Angel Falls',
    incorrectAnswers: ['Victoria Falls', 'Niagara Falls', 'Iguazu Falls'],
    difficulty: 'medium'
  },
  {
    id: 'geo_26',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Turkey?',
    correctAnswer: 'Ankara',
    incorrectAnswers: ['Istanbul', 'Izmir', 'Antalya'],
    difficulty: 'medium'
  },
  {
    id: 'geo_27',
    category: 'GEOGRAPHY',
    question: 'Which island is the largest island in the world by land area?',
    correctAnswer: 'Greenland',
    incorrectAnswers: ['New Guinea', 'Borneo', 'Madagascar'],
    difficulty: 'easy'
  },
  {
    id: 'geo_28',
    category: 'GEOGRAPHY',
    question: 'Which US state has the longest total ocean coastline?',
    correctAnswer: 'Alaska',
    incorrectAnswers: ['Florida', 'California', 'Hawaii'],
    difficulty: 'medium'
  },
  {
    id: 'geo_29',
    category: 'GEOGRAPHY',
    question: 'What is the capital city of Thailand?',
    correctAnswer: 'Bangkok',
    incorrectAnswers: ['Chiang Mai', 'Phuket', 'Pattaya'],
    difficulty: 'easy'
  },
  {
    id: 'geo_30',
    category: 'GEOGRAPHY',
    question: 'Which two countries share the longest international land border in the world?',
    correctAnswer: 'Canada and the United States',
    incorrectAnswers: ['Russia and China', 'Argentina and Chile', 'India and Bangladesh'],
    difficulty: 'medium'
  },

  // ==========================================
  // WORLD HISTORY (30 questions)
  // ==========================================
  {
    id: 'his_1',
    category: 'HISTORY',
    question: 'In what year did Christopher Columbus first make landfall in the Americas?',
    correctAnswer: '1492',
    incorrectAnswers: ['1488', '1502', '1519'],
    difficulty: 'easy'
  },
  {
    id: 'his_2',
    category: 'HISTORY',
    question: 'Who was the first President of the United States under the US Constitution?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg/480px-Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg',
    correctAnswer: 'George Washington',
    incorrectAnswers: ['Thomas Jefferson', 'John Adams', 'Benjamin Franklin'],
    difficulty: 'easy'
  },
  {
    id: 'his_3',
    category: 'HISTORY',
    question: 'In what year did World War II officially end with the surrender of the Axis powers?',
    correctAnswer: '1945',
    incorrectAnswers: ['1944', '1946', '1939'],
    difficulty: 'easy'
  },
  {
    id: 'his_4',
    category: 'HISTORY',
    question: 'Who was the famous French military leader who crowned himself Emperor of the French in 1804?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg/480px-Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg',
    correctAnswer: 'Napoleon Bonaparte',
    incorrectAnswers: ['Louis XIV', 'Charles de Gaulle', 'Maximilien Robespierre'],
    difficulty: 'easy'
  },
  {
    id: 'his_5',
    category: 'HISTORY',
    question: 'Which ancient Egyptian queen was the last active ruler of the Ptolemaic Kingdom?',
    correctAnswer: 'Cleopatra VII',
    incorrectAnswers: ['Nefertiti', 'Hatshepsut', 'Sobekneferu'],
    difficulty: 'easy'
  },
  {
    id: 'his_6',
    category: 'HISTORY',
    question: 'What massive fortified wall was built across northern England by the Romans starting in 122 AD?',
    correctAnswer: 'Hadrian\'s Wall',
    incorrectAnswers: ['Antonine Wall', 'Servian Wall', 'Aurelian Wall'],
    difficulty: 'medium'
  },
  {
    id: 'his_7',
    category: 'HISTORY',
    question: 'In what year did the Berlin Wall fall, signaling the impending collapse of the Soviet Eastern Bloc?',
    correctAnswer: '1989',
    incorrectAnswers: ['1991', '1987', '1985'],
    difficulty: 'medium'
  },
  {
    id: 'his_8',
    category: 'HISTORY',
    question: 'Who led the Mongol Empire to conquer vast swathes of Eurasia during the early 13th century?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/YuanGenghisAlbum.jpg/480px-YuanGenghisAlbum.jpg',
    correctAnswer: 'Genghis Khan',
    incorrectAnswers: ['Kublai Khan', 'Attila the Hun', 'Tamerlane'],
    difficulty: 'easy'
  },
  {
    id: 'his_9',
    category: 'HISTORY',
    question: 'Which Roman general was assassinated on the Ides of March in 44 BC?',
    correctAnswer: 'Julius Caesar',
    incorrectAnswers: ['Mark Antony', 'Augustus', 'Nero'],
    difficulty: 'easy'
  },
  {
    id: 'his_10',
    category: 'HISTORY',
    question: 'The sinking of which ocean liner in April 1912 resulted in over 1,500 casualties?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/RMS_Titanic_3.jpg/640px-RMS_Titanic_3.jpg',
    correctAnswer: 'RMS Titanic',
    incorrectAnswers: ['RMS Lusitania', 'HMHS Britannic', 'SS Andrea Doria'],
    difficulty: 'easy'
  },
  {
    id: 'his_11',
    category: 'HISTORY',
    question: 'Who was the Prime Minister of the United Kingdom for the majority of World War II?',
    correctAnswer: 'Winston Churchill',
    incorrectAnswers: ['Neville Chamberlain', 'Clement Attlee', 'Anthony Eden'],
    difficulty: 'easy'
  },
  {
    id: 'his_12',
    category: 'HISTORY',
    question: 'Which civil rights leader delivered the iconic "I Have a Dream" speech at the Lincoln Memorial in 1963?',
    correctAnswer: 'Martin Luther King Jr.',
    incorrectAnswers: ['Malcolm X', 'John Lewis', 'Medgar Evers'],
    difficulty: 'easy'
  },
  {
    id: 'his_13',
    category: 'HISTORY',
    question: 'Which devastating pandemic caused by Yersinia pestis wiped out an estimated 30-60% of Europe\'s population in the 14th century?',
    correctAnswer: 'The Black Death (Bubonic Plague)',
    incorrectAnswers: ['The Spanish Flu', 'The Antonine Plague', 'The Justinian Plague'],
    difficulty: 'easy'
  },
  {
    id: 'his_14',
    category: 'HISTORY',
    question: 'In what year did the French Revolution begin with the Storming of the Bastille?',
    correctAnswer: '1789',
    incorrectAnswers: ['1776', '1799', '1804'],
    difficulty: 'medium'
  },
  {
    id: 'his_15',
    category: 'HISTORY',
    question: 'Which ancient king of Macedonia created one of history\'s largest empires stretching from Greece to northwestern India?',
    correctAnswer: 'Alexander the Great',
    incorrectAnswers: ['Philip II', 'Darius III', 'Pericles'],
    difficulty: 'easy'
  },
  {
    id: 'his_16',
    category: 'HISTORY',
    question: 'Which city was the capital of the Byzantine Empire for over a millennium before falling in 1453?',
    correctAnswer: 'Constantinople',
    incorrectAnswers: ['Rome', 'Alexandria', 'Athens'],
    difficulty: 'medium'
  },
  {
    id: 'his_17',
    category: 'HISTORY',
    question: 'Who was the longest-reigning British monarch in history, reigning for over 70 years from 1952 to 2022?',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Queen_Elizabeth_II_in_March_2015.jpg/480px-Queen_Elizabeth_II_in_March_2015.jpg',
    correctAnswer: 'Queen Elizabeth II',
    incorrectAnswers: ['Queen Victoria', 'King George III', 'Queen Elizabeth I'],
    difficulty: 'easy'
  },
  {
    id: 'his_18',
    category: 'HISTORY',
    question: 'The assassination of Archduke Franz Ferdinand in 1914 directly triggered the outbreak of which war?',
    correctAnswer: 'World War I',
    incorrectAnswers: ['World War II', 'Franco-Prussian War', 'Crimean War'],
    difficulty: 'easy'
  },
  {
    id: 'his_19',
    category: 'HISTORY',
    question: 'Who was the first Emperor of Rome, who took power after the fall of the Roman Republic?',
    correctAnswer: 'Augustus (Octavian)',
    incorrectAnswers: ['Julius Caesar', 'Tiberius', 'Nero'],
    difficulty: 'medium'
  },
  {
    id: 'his_20',
    category: 'HISTORY',
    question: 'Which South African anti-apartheid leader served 27 years in prison before becoming President in 1994?',
    correctAnswer: 'Nelson Mandela',
    incorrectAnswers: ['Desmond Tutu', 'Steve Biko', 'Thabo Mbeki'],
    difficulty: 'easy'
  },
  {
    id: 'his_21',
    category: 'HISTORY',
    question: 'The ancient city of Pompeii was buried and preserved in 79 AD by the eruption of which volcano?',
    correctAnswer: 'Mount Vesuvius',
    incorrectAnswers: ['Mount Etna', 'Mount Stromboli', 'Mount Saint Helens'],
    difficulty: 'easy'
  },
  {
    id: 'his_22',
    category: 'HISTORY',
    question: 'Who pioneered the movable-type printing press in Europe around 1440, revolutionizing book publishing?',
    correctAnswer: 'Johannes Gutenberg',
    incorrectAnswers: ['William Caxton', 'Albrecht Dürer', 'Desiderius Erasmus'],
    difficulty: 'easy'
  },
  {
    id: 'his_23',
    category: 'HISTORY',
    question: 'What famous charter of rights was signed by King John of England at Runnymede in 1215?',
    correctAnswer: 'Magna Carta',
    incorrectAnswers: ['English Bill of Rights', 'Treaty of Paris', 'Domesday Book'],
    difficulty: 'easy'
  },
  {
    id: 'his_24',
    category: 'HISTORY',
    question: 'Which Mesoamerican civilization was conquered by Hernán Cortés and his Spanish conquistadors in 1521?',
    correctAnswer: 'The Aztec Empire',
    incorrectAnswers: ['The Inca Empire', 'The Maya Civilization', 'The Olmecs'],
    difficulty: 'medium'
  },
  {
    id: 'his_25',
    category: 'HISTORY',
    question: 'Who was the female pharaoh of Egypt who oversaw great trade expeditions and built the temple at Deir el-Bahari?',
    correctAnswer: 'Hatshepsut',
    incorrectAnswers: ['Cleopatra', 'Nefertiti', 'Merneith'],
    difficulty: 'hard'
  },
  {
    id: 'his_26',
    category: 'HISTORY',
    question: 'In what year was the United States Declaration of Independence adopted in Philadelphia?',
    correctAnswer: '1776',
    incorrectAnswers: ['1789', '1783', '1770'],
    difficulty: 'easy'
  },
  {
    id: 'his_27',
    category: 'HISTORY',
    question: 'Which Soviet leader implemented the reforms of "Glasnost" (openness) and "Perestroika" (restructuring)?',
    correctAnswer: 'Mikhail Gorbachev',
    incorrectAnswers: ['Nikita Khrushchev', 'Leonid Brezhnev', 'Boris Yeltsin'],
    difficulty: 'medium'
  },
  {
    id: 'his_28',
    category: 'HISTORY',
    question: 'What famous naval battle in 1805 saw British Admiral Lord Nelson defeat the combined French and Spanish fleets?',
    correctAnswer: 'Battle of Trafalgar',
    incorrectAnswers: ['Battle of Waterloo', 'Battle of the Nile', 'Battle of Jutland'],
    difficulty: 'medium'
  },
  {
    id: 'his_29',
    category: 'HISTORY',
    question: 'Which dynasty was the last imperial dynasty of China, ruling from 1644 to 1912?',
    correctAnswer: 'Qing Dynasty',
    incorrectAnswers: ['Ming Dynasty', 'Tang Dynasty', 'Han Dynasty'],
    difficulty: 'medium'
  },
  {
    id: 'his_30',
    category: 'HISTORY',
    question: 'Who was the primary author of the US Declaration of Independence and the third US President?',
    correctAnswer: 'Thomas Jefferson',
    incorrectAnswers: ['Alexander Hamilton', 'James Madison', 'John Adams'],
    difficulty: 'easy'
  }
];
