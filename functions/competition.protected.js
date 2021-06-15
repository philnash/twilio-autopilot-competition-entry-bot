const Airtable = require("airtable");
const questions = require(Runtime.getAssets()["/questions.js"].path);

exports.handler = async (context, event, callback) => {
  const now = new Date();
  const questionDetails = questions.find((question) => {
    return now < question.liveUntil;
  });

  if (!questionDetails) {
    return callback(null, {
      actions: [
        {
          say: "This competition is now over. Thank you for playing!",
        },
      ],
    });
  }

  const memory = JSON.parse(event.Memory);
  const user = memory.twilio.chat
    ? memory.twilio.chat
    : memory.twilio["messaging.facebook-messenger"];
  const userId = user.From;

  const airtable = new Airtable({ apiKey: context.AIRTABLE_API_KEY });
  const base = airtable.base(context.AIRTABLE_BASE_ID);
  const table = base.table("Users");
  let users;

  try {
    users = await table
      .select({
        maxRecords: 1,
        filterByFormula: `{ID} = '${userId}'`,
      })
      .firstPage();
  } catch (err) {
    users = [];
  }

  const response = {
    actions: [],
  };

  const questionText = `${questionDetails.question}\n${["A", "B", "C"]
    .map((letter) => `${letter}: ${questionDetails.options[letter]}`)
    .join("\n")}`;
  const competitionQuestion = {
    question: questionText,
    name: `week${questionDetails.week}`,
    validate: {
      allowed_values: {
        list: ["A", "B", "C"],
      },
      on_failure: {
        messages: [
          {
            say: `That's not one of the possible answers.\n\n${questionText}`,
          },
        ],
        repeat_question: false,
      },
    },
  };

  if (users.length > 0) {
    const user = users[0];
    const name = user.get("Name");
    const answered = user.get(`week${questionDetails.week}`);
    if (answered) {
      response.actions.push({
        say: `Hi ${name}, I see you have already entered this week's competition. Come back after the next episode for your next question.`,
      });
    } else {
      response.actions.push({
        remember: {
          userAirtableId: user.id,
          week: questionDetails.week,
        },
      });
      response.actions.push({
        say: `Welcome back ${name}. Here is this week's question.`,
      });
      response.actions.push({
        collect: {
          name: "watch_and_win",
          questions: [competitionQuestion],
          on_complete: {
            redirect: {
              method: "POST",
              uri: `https://${context.DOMAIN_NAME}/answers`,
            },
          },
        },
      });
    }
  } else {
    response.actions.push({
      remember: {
        week: questionDetails.week,
      },
    });
    response.actions.push({
      say: "Thanks for taking part in the competition. Here's this week's question, plus a few more so we can get some important details from you. You must answer all questions to enter.",
    });

    response.actions.push({
      collect: {
        name: "watch_and_win",
        questions: [
          competitionQuestion,
          {
            question: "Great! What's your name?",
            name: "Name",
            validate: false,
          },
          {
            question:
              "What is your email address? We need this to contact you if you win.",
            name: "Email",
            type: "Twilio.EMAIL",
            validate: {
              on_failure: {
                messages: [
                  {
                    say: "Please enter a valid email address. We need this to contact you if you win.",
                  },
                ],
                repeat_question: false,
              },
            },
          },
          {
            question:
              "Do you agree to the terms and conditions of the competition?",
            name: "Terms",
            type: "Twilio.YES_NO",
            validate: {
              allowed_values: {
                list: ["yes"],
              },
              on_failure: {
                messages: [
                  {
                    say: "You need to agree to the terms and conditions and the privacy policy to take part in the competition. Please type 'yes' to confirm that you agree.",
                  },
                ],
                repeat_question: false,
              },
            },
          },
        ],
        on_complete: {
          redirect: {
            method: "POST",
            uri: `https://${context.DOMAIN_NAME}/answers`,
          },
        },
      },
    });
  }

  callback(null, response);
};
