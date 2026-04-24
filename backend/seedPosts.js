/**
 * ═══════════════════════════════════════════════════════════════
 * THE SECRET — FEED SEED SCRIPT
 * Generates 55 realistic, human-like anonymous posts
 * ═══════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');
const Post = require('./models/Post');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/the-secret';

// ── Time helpers ──────────────────────────────────────────────
function ago(hours, jitterMins = 0) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  d.setMinutes(d.getMinutes() - Math.floor(Math.random() * jitterMins));
  return d;
}

// ── 55 Realistic Posts ────────────────────────────────────────
const posts = [
  // ─── CONFESSIONS (15) ──────────────────────────────────────
  { content: "I still think about the person I ghosted two years ago. Not a day goes by where I don't wonder if they're okay. I was too scared to explain myself.", mood: "confession", tags: ["regret", "relationships"], likesCount: 47, commentsCount: 12, engagementVelocity: 3.2, feedScore: 88 },
  { content: "I pretend to be confident at work but every single morning I sit in the parking lot for 10 minutes just breathing before I can walk in.", mood: "confession", tags: ["anxiety", "work"], likesCount: 89, commentsCount: 23, engagementVelocity: 6.1, feedScore: 95 },
  { content: "My best friend's wedding is next month. I'm the best man. I'm also in love with the bride. I've never told anyone.", mood: "confession", tags: ["love", "secrets"], likesCount: 134, commentsCount: 45, engagementVelocity: 9.8, feedScore: 99 },
  { content: "I dropped out of engineering in 3rd year and told my parents I graduated. They still think I have a degree. It's been 4 years.", mood: "confession", tags: ["family", "education"], likesCount: 72, commentsCount: 31, engagementVelocity: 5.4, feedScore: 91 },
  { content: "Sometimes I order food for two just so the delivery person doesn't think I'm eating alone.", mood: "confession", tags: ["loneliness", "life"], likesCount: 156, commentsCount: 38, engagementVelocity: 8.7, feedScore: 97 },
  { content: "I read my ex's horoscope every morning hoping the universe tells me they're thinking about me too.", mood: "confession", tags: ["love", "breakup"], likesCount: 63, commentsCount: 15, engagementVelocity: 4.1, feedScore: 82 },
  { content: "I've been going to therapy for 6 months and haven't told a single person in my life. Everyone thinks I'm 'naturally getting better.'", mood: "confession", tags: ["mentalhealth", "therapy"], likesCount: 201, commentsCount: 52, engagementVelocity: 11.2, feedScore: 100 },
  { content: "I saved a stranger from drowning at the beach last summer. I never told anyone because I had a panic attack right after and felt embarrassed.", mood: "confession", tags: ["life", "anxiety"], likesCount: 178, commentsCount: 41, engagementVelocity: 7.9, feedScore: 96 },
  { content: "My mom calls me every Sunday. I let it ring sometimes because hearing her voice makes me cry from homesickness. I moved 2000km away.", mood: "confession", tags: ["family", "homesick"], likesCount: 112, commentsCount: 28, engagementVelocity: 6.3, feedScore: 93 },
  { content: "I've been pretending to like coffee for 5 years because everyone at my office is a coffee snob. I actually hate the taste. I just want to fit in.", mood: "confession", tags: ["work", "funny"], likesCount: 95, commentsCount: 19, engagementVelocity: 4.8, feedScore: 85 },
  { content: "I wrote a letter to my future self 10 years ago. Opened it last week. I've achieved nothing on that list. Not one thing.", mood: "confession", tags: ["life", "reflection"], likesCount: 67, commentsCount: 22, engagementVelocity: 3.9, feedScore: 80 },
  { content: "I take the long route home every day just to pass by the bookstore where I first met her. She doesn't work there anymore.", mood: "confession", tags: ["love", "nostalgia"], likesCount: 88, commentsCount: 16, engagementVelocity: 5.0, feedScore: 86 },
  { content: "I forgave my father last year. He doesn't know it. I just stopped being angry one random Tuesday.", mood: "confession", tags: ["family", "healing"], likesCount: 143, commentsCount: 35, engagementVelocity: 7.2, feedScore: 94 },
  { content: "I applied to 347 jobs before I got my first offer. I tell people it was easy. It wasn't.", mood: "confession", tags: ["career", "struggle"], likesCount: 189, commentsCount: 47, engagementVelocity: 10.1, feedScore: 98 },
  { content: "I smile at everyone at college. Nobody knows I eat lunch alone in the library every single day.", mood: "confession", tags: ["loneliness", "college"], likesCount: 224, commentsCount: 56, engagementVelocity: 12.4, feedScore: 100 },

  // ─── RANTS (12) ────────────────────────────────────────────
  { content: "Why do people schedule meetings that could've been emails?? I just lost 2 hours of my life to a 'quick sync' where nothing was decided.", mood: "rant", tags: ["work", "corporate"], likesCount: 167, commentsCount: 43, engagementVelocity: 8.5, feedScore: 96 },
  { content: "Landlord raised rent by 30% and said 'market conditions.' Bro the only condition is your greed. Where do I even go now?", mood: "rant", tags: ["rent", "life"], likesCount: 198, commentsCount: 61, engagementVelocity: 11.3, feedScore: 99 },
  { content: "Stop telling people with depression to 'just go for a walk.' If walking cured depression, every postman would be the happiest person alive.", mood: "rant", tags: ["mentalhealth", "society"], likesCount: 312, commentsCount: 78, engagementVelocity: 14.7, feedScore: 100 },
  { content: "I hate how 'networking' is just adults pretending to like each other for career benefits. Can we just be honest about it?", mood: "rant", tags: ["career", "truth"], likesCount: 145, commentsCount: 37, engagementVelocity: 7.1, feedScore: 92 },
  { content: "People who leave their shopping carts in the middle of the parking lot are the same people who don't use turn signals. Change my mind.", mood: "rant", tags: ["funny", "society"], likesCount: 89, commentsCount: 21, engagementVelocity: 4.3, feedScore: 83 },
  { content: "Group projects in college are just a masterclass in doing 80% of the work and splitting credit 5 ways.", mood: "rant", tags: ["college", "frustration"], likesCount: 176, commentsCount: 44, engagementVelocity: 9.2, feedScore: 95 },
  { content: "The education system rewards memorization over understanding and then wonders why graduates can't think critically. We're creating robots.", mood: "rant", tags: ["education", "society"], likesCount: 231, commentsCount: 55, engagementVelocity: 12.1, feedScore: 98 },
  { content: "Dating apps have made it so easy to meet people and somehow so much harder to actually connect with anyone. What are we doing?", mood: "rant", tags: ["dating", "modern"], likesCount: 154, commentsCount: 42, engagementVelocity: 7.8, feedScore: 93 },
  { content: "Can we talk about how toxic hustle culture is? Not everyone's passion is their career. Some of us just want to live. That should be enough.", mood: "rant", tags: ["culture", "life"], likesCount: 267, commentsCount: 63, engagementVelocity: 13.5, feedScore: 100 },
  { content: "Job posting: 'Entry level position. Requirements: 5 years experience, PhD preferred, must know 12 programming languages, salary: unpaid internship vibes.'", mood: "rant", tags: ["jobs", "funny"], likesCount: 289, commentsCount: 71, engagementVelocity: 14.2, feedScore: 100 },
  { content: "I love how everyone is a mental health advocate online but the moment someone actually opens up they get ghosted. The hypocrisy is wild.", mood: "rant", tags: ["mentalhealth", "truth"], likesCount: 198, commentsCount: 48, engagementVelocity: 10.6, feedScore: 97 },
  { content: "The wifi at my PG goes out every evening right at peak hours. I'm paying 15k a month for the privilege of buffering. This is fine. Everything is fine.", mood: "rant", tags: ["hostel", "life"], likesCount: 76, commentsCount: 18, engagementVelocity: 3.7, feedScore: 79 },

  // ─── POSITIVE (15) ─────────────────────────────────────────
  { content: "A stranger on the bus noticed I was having a bad day and gave me a handwritten note that said 'It gets better. Trust me.' I've kept it in my wallet.", mood: "positive", tags: ["kindness", "life"], likesCount: 345, commentsCount: 67, engagementVelocity: 15.8, feedScore: 100 },
  { content: "Today my little sister called me her hero. I was just helping her with math homework. But man, I've never felt more important in my life.", mood: "positive", tags: ["family", "love"], likesCount: 267, commentsCount: 52, engagementVelocity: 12.9, feedScore: 99 },
  { content: "After 3 years of trying, I finally cleared my exam. My hands were shaking when I saw the result. Mom was the first call. She cried. I cried. 🎉", mood: "positive", tags: ["achievement", "education"], likesCount: 412, commentsCount: 89, engagementVelocity: 18.3, feedScore: 100 },
  { content: "I adopted a stray kitten last month. She sleeps on my chest every night now. For the first time in years, my apartment doesn't feel empty.", mood: "positive", tags: ["pets", "healing"], likesCount: 298, commentsCount: 58, engagementVelocity: 14.1, feedScore: 100 },
  { content: "My therapist told me today that I've made 'remarkable progress.' I don't always see it myself, but hearing someone else say it meant everything.", mood: "positive", tags: ["mentalhealth", "progress"], likesCount: 187, commentsCount: 41, engagementVelocity: 9.4, feedScore: 96 },
  { content: "Ran my first 5K today. Came last place. But I finished. Three months ago I couldn't walk up stairs without gasping. Progress isn't always loud.", mood: "positive", tags: ["fitness", "growth"], likesCount: 356, commentsCount: 72, engagementVelocity: 16.2, feedScore: 100 },
  { content: "I cooked a full meal from scratch today — dal, rice, sabzi, even roti. My roommate said it tasted like home. Best compliment ever.", mood: "positive", tags: ["cooking", "life"], likesCount: 134, commentsCount: 29, engagementVelocity: 6.8, feedScore: 89 },
  { content: "The sunset today was unreal. Sat on my terrace with chai and just... existed. No phone, no noise. Just sky. We need more of these moments.", mood: "positive", tags: ["peace", "nature"], likesCount: 178, commentsCount: 34, engagementVelocity: 8.1, feedScore: 93 },
  { content: "Someone at work anonymously left a 'Thank You' note on my desk. I've been feeling invisible for months. That small act changed my whole week.", mood: "positive", tags: ["work", "kindness"], likesCount: 223, commentsCount: 45, engagementVelocity: 11.7, feedScore: 98 },
  { content: "My dad, who never says 'I love you,' texted me today: 'Take care of yourself. I worry.' That's his version. And it's enough. ❤️", mood: "positive", tags: ["family", "love"], likesCount: 387, commentsCount: 81, engagementVelocity: 17.4, feedScore: 100 },
  { content: "I deleted Instagram and Twitter 2 months ago. My anxiety has reduced by like 60%. Turns out the real world is actually... nice?", mood: "positive", tags: ["mentalhealth", "digital"], likesCount: 198, commentsCount: 43, engagementVelocity: 10.3, feedScore: 97 },
  { content: "Planted a mango seed 2 years ago as a joke. It's now a 4-foot tree. Sometimes the things you forget about are the ones that grow the most.", mood: "positive", tags: ["nature", "metaphor"], likesCount: 245, commentsCount: 49, engagementVelocity: 12.6, feedScore: 99 },
  { content: "My professor, who failed me last year, came up to me today and said 'You've improved tremendously. I'm proud.' Redemption arc: complete.", mood: "positive", tags: ["college", "growth"], likesCount: 312, commentsCount: 64, engagementVelocity: 15.1, feedScore: 100 },
  { content: "I went to a concert alone yesterday. Danced like nobody was watching. Because nobody was. And it was the most free I've ever felt.", mood: "positive", tags: ["freedom", "music"], likesCount: 167, commentsCount: 38, engagementVelocity: 8.9, feedScore: 94 },
  { content: "Old school friend texted me out of nowhere: 'Remember that time we bunked class to watch a movie? Good times.' Made my entire day. Some bonds don't need maintenance.", mood: "positive", tags: ["friendship", "nostalgia"], likesCount: 145, commentsCount: 31, engagementVelocity: 7.3, feedScore: 91 },

  // ─── RANDOM (13) ───────────────────────────────────────────
  { content: "Do you ever think about how a dog has no idea what country it's in?", mood: "random", tags: ["thoughts", "funny"], likesCount: 234, commentsCount: 56, engagementVelocity: 11.9, feedScore: 98 },
  { content: "3 AM thoughts: If time travel exists in the future, why hasn't anyone come back to fix things? Unless... this IS the fixed version. 😳", mood: "random", tags: ["philosophy", "night"], likesCount: 189, commentsCount: 47, engagementVelocity: 9.7, feedScore: 95 },
  { content: "Just realized that 'studying' is just 'student' and 'dying' combined. It all makes sense now.", mood: "random", tags: ["funny", "college"], likesCount: 278, commentsCount: 59, engagementVelocity: 13.8, feedScore: 100 },
  { content: "What if plants are really farming us — giving us oxygen until we decompose and they can consume us? 🌱", mood: "random", tags: ["philosophy", "weird"], likesCount: 156, commentsCount: 41, engagementVelocity: 8.2, feedScore: 92 },
  { content: "The fact that we have to pay to exist on earth is actually insane when you think about it. Like I didn't even ask to be here.", mood: "random", tags: ["life", "thoughts"], likesCount: 345, commentsCount: 82, engagementVelocity: 16.7, feedScore: 100 },
  { content: "Every pizza is a personal pizza if you believe in yourself.", mood: "random", tags: ["funny", "food"], likesCount: 198, commentsCount: 34, engagementVelocity: 9.1, feedScore: 94 },
  { content: "I wonder if the inventor of the clock was like 'I'll tell you what time it is' and everyone just went along with it.", mood: "random", tags: ["thoughts", "funny"], likesCount: 123, commentsCount: 27, engagementVelocity: 6.5, feedScore: 87 },
  { content: "Your bed is basically a wireless charging station for humans.", mood: "random", tags: ["thoughts", "tech"], likesCount: 267, commentsCount: 48, engagementVelocity: 12.8, feedScore: 99 },
  { content: "Somewhere in the world, someone is having the best day of their life right now. And someone else just stepped in a puddle wearing socks. Balance.", mood: "random", tags: ["philosophy", "funny"], likesCount: 189, commentsCount: 39, engagementVelocity: 9.5, feedScore: 95 },
  { content: "If you rip a hole in a net, there are actually fewer holes in it than before. Think about that.", mood: "random", tags: ["mindblown", "thoughts"], likesCount: 312, commentsCount: 67, engagementVelocity: 15.3, feedScore: 100 },
  { content: "Accidentally said 'you too' when the waiter said 'enjoy your meal.' I'm moving to a new city.", mood: "random", tags: ["funny", "awkward"], likesCount: 234, commentsCount: 51, engagementVelocity: 11.4, feedScore: 97 },
  { content: "The 'cool' kids in school peaked in 10th grade. The weird kids built startups. Just an observation.", mood: "random", tags: ["life", "truth"], likesCount: 178, commentsCount: 44, engagementVelocity: 8.7, feedScore: 93 },
  { content: "Plot twist: Monday is actually the best day of the week because nobody expects anything from you. The bar is already on the floor.", mood: "random", tags: ["funny", "work"], likesCount: 145, commentsCount: 32, engagementVelocity: 7.1, feedScore: 90 },
];

// ── Seed Function ─────────────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📦 Connected to MongoDB');

    // Get all existing users to distribute posts across them
    const users = await User.find({ isActive: true }).select('_id');
    if (users.length === 0) {
      console.error('❌ No users found. Create at least one user first.');
      process.exit(1);
    }
    console.log(`👥 Found ${users.length} user(s) to distribute posts across`);

    // Count existing posts
    const existingCount = await Post.countDocuments({ isDeleted: false });
    console.log(`📊 Existing posts: ${existingCount}`);

    // Prepare posts with realistic timestamps and distributed authors
    const now = Date.now();
    const prepared = posts.map((p, i) => {
      // Spread posts over 72 hours with some jitter
      const hoursAgo = (i / posts.length) * 72;
      const jitter = Math.random() * 60; // 0-60 min jitter

      return {
        author: users[Math.floor(Math.random() * users.length)]._id,
        isAnonymous: true,
        content: p.content,
        contentType: 'text',
        mood: p.mood,
        tags: p.tags || [],
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        engagementVelocity: p.engagementVelocity || 0,
        feedScore: p.feedScore || 50,
        moderationStatus: 'approved',
        moderatedBy: 'system_blocklist',
        moderatedAt: new Date(),
        createdAt: ago(hoursAgo, jitter),
        updatedAt: ago(hoursAgo, jitter),
      };
    });

    // Insert all posts
    const result = await Post.insertMany(prepared);
    console.log(`\n✅ Successfully seeded ${result.length} posts!`);
    console.log(`📊 Total posts now: ${existingCount + result.length}`);

    // Stats breakdown
    const moods = {};
    prepared.forEach(p => { moods[p.mood] = (moods[p.mood] || 0) + 1; });
    console.log('\n📈 Mood Distribution:');
    Object.entries(moods).forEach(([mood, count]) => {
      const emoji = { confession: '😔', rant: '😤', positive: '🌟', random: '🎲' }[mood] || '•';
      console.log(`   ${emoji} ${mood}: ${count} posts`);
    });

    console.log('\n🎉 Feed is ready! Refresh your app to see the posts.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
