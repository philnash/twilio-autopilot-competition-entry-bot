const Airtable = require("airtable");

exports.handler = async (context, event, callback) => {
  const airtable = new Airtable({ apiKey: context.AIRTABLE_API_KEY });
  const base = airtable.base(context.AIRTABLE_BASE_ID);
  const table = base.table("Users");

  const memory = JSON.parse(event.Memory);

  const user = memory.twilio.chat
    ? memory.twilio.chat
    : memory.twilio["messaging.facebook-messenger"];
  const userId = user.From;

  const answerFields = memory.twilio.collected_data.watch_and_win.answers;
  const userAnswers = Object.keys(answerFields).reduce((acc, field) => {
    acc[field] = answerFields[field].answer;
    return acc;
  }, {});
  userAnswers["ID"] = userId;

  const userAirtableId = memory.userAirtableId;

  if (userAirtableId) {
    await table.update(userAirtableId, userAnswers);
  } else {
    await table.create(userAnswers);
  }

  callback(null, {
    actions: [
      {
        say: "Thanks for entering the competition, good luck!",
      },
    ],
  });
};
