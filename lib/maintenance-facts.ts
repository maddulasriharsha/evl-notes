/** Fun facts and (gentle) jokes shown on the maintenance page while visitors wait. */
export interface Fact {
  kind: 'fact' | 'joke'
  subject: string
  text: string
}

export const FACTS: Fact[] = [
  // Maths
  { kind: 'fact', subject: 'Maths', text: 'There are more ways to shuffle a deck of 52 cards than there are atoms on Earth.' },
  { kind: 'fact', subject: 'Maths', text: 'Zero is the only number that cannot be written in Roman numerals.' },
  { kind: 'fact', subject: 'Maths', text: 'A googol is a 1 followed by 100 zeros. Google got its name from a misspelling of it.' },
  { kind: 'joke', subject: 'Maths', text: 'Why was the maths book sad? It had too many problems.' },
  { kind: 'joke', subject: 'Maths', text: 'Parallel lines have so much in common. It is a shame they will never meet.' },
  { kind: 'joke', subject: 'Calculus', text: 'Old integrals never die. They just lose their constants.' },
  // Physics
  { kind: 'fact', subject: 'Physics', text: 'Sunlight takes about 8 minutes and 20 seconds to reach the Earth.' },
  { kind: 'fact', subject: 'Physics', text: 'A day on Venus is longer than its year: it spins so slowly that one turn takes longer than one trip around the Sun.' },
  { kind: 'joke', subject: 'Physics', text: 'I would tell you a joke about gravity, but it might fall flat.' },
  { kind: 'joke', subject: 'Physics', text: 'Never trust atoms. They make up everything.' },
  // Chemistry
  { kind: 'fact', subject: 'Chemistry', text: 'Ice floats because water expands as it freezes. That is why lakes freeze from the top and the fish below survive.' },
  { kind: 'joke', subject: 'Chemistry', text: 'I would tell you a chemistry joke, but I know I would not get a reaction.' },
  // Programming
  { kind: 'fact', subject: 'Programming', text: 'The first computer "bug" was a real moth, found stuck in a Harvard Mark II relay in 1947.' },
  { kind: 'fact', subject: 'Programming', text: 'Ada Lovelace wrote what is often called the first computer program in the 1840s, a century before modern computers.' },
  { kind: 'fact', subject: 'Programming', text: 'Ray Tomlinson picked the @ symbol for email addresses in 1971.' },
  { kind: 'joke', subject: 'Programming', text: 'Why do programmers prefer dark mode? Because light attracts bugs.' },
  { kind: 'joke', subject: 'Programming', text: 'There are 10 kinds of people: those who understand binary and those who do not.' },
  { kind: 'joke', subject: 'Programming', text: 'A SQL query walks into a bar, goes up to two tables and asks: "Can I join you?"' },
  { kind: 'joke', subject: 'Programming', text: 'Debugging is being the detective in a crime movie where you are also the murderer.' },
  { kind: 'joke', subject: 'C & Java', text: 'Why do Java developers wear glasses? Because they do not C#.' },
  // Data structures & databases
  { kind: 'joke', subject: 'Data Structures', text: 'The best thing about a Boolean is that even when you are wrong, you are only off by a bit.' },
  { kind: 'joke', subject: 'Databases', text: 'A DBA left his wife for another table. They had too many foreign keys.' },
  // Electronics & electrical
  { kind: 'fact', subject: 'Electrical', text: 'The electrons in a wire drift at only millimetres per second. The signal itself travels at close to the speed of light.' },
  { kind: 'fact', subject: 'Electronics', text: 'The first transistor was built in 1947. Today a chip the size of your fingernail holds billions of them.' },
  { kind: 'joke', subject: 'Electrical', text: 'Why do electricians never get lost? They always follow the current.' },
  { kind: 'joke', subject: 'Electronics', text: 'I would tell you a joke about electricity, but I find it shocking.' },
  { kind: 'joke', subject: 'Signals', text: 'Why was the signal so calm? It had a good filter against noise.' },
  // Mechanical, civil, automobile
  { kind: 'fact', subject: 'Mechanical', text: 'The Eiffel Tower can grow taller by up to about 15 cm in summer, because its iron expands in the heat.' },
  { kind: 'joke', subject: 'Mechanical', text: 'Mechanical engineers do not have problems. They have stress, strain and the occasional failure.' },
  { kind: 'fact', subject: 'Civil', text: 'The dome of the Pantheon in Rome, built about 1,900 years ago, is still the largest unreinforced concrete dome in the world.' },
  { kind: 'joke', subject: 'Civil', text: 'A civil engineer\'s favourite song is any song with a good bridge.' },
  { kind: 'fact', subject: 'Automobile', text: 'One of the first speeding fines, in 1896, was for driving at 8 mph in a 2 mph zone.' },
  // Networks, AI, robotics
  { kind: 'fact', subject: 'Networks', text: 'The first message sent over ARPANET, in 1969, was meant to be "LOGIN". The system crashed after "LO".' },
  { kind: 'fact', subject: 'AI', text: 'The term "artificial intelligence" was coined at a summer workshop at Dartmouth in 1956.' },
  { kind: 'fact', subject: 'Robotics', text: 'The word "robot" comes from the Czech "robota", meaning forced labour, from a 1920 play.' },
  { kind: 'joke', subject: 'AI', text: 'My neural network and I broke up. It said I was overfitting the relationship.' },
  // English & exams
  { kind: 'fact', subject: 'English', text: 'The word "set" has over 400 meanings in the Oxford English Dictionary, more than any other English word.' },
  { kind: 'joke', subject: 'Exams', text: 'In an exam paper, "Explain briefly" means "write four pages".' },
  { kind: 'fact', subject: 'Study tip', text: 'Sleep helps memory stick. A good night\'s rest before an exam usually beats an all-nighter.' },
  { kind: 'fact', subject: 'Study tip', text: 'Testing yourself (past papers, quick quizzes) helps you remember more than rereading your notes.' },
]
