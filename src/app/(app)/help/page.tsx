const FAQ = [
  {
    q: "What am I supposed to do here?",
    a: "Enter the numbers your organisation needs for its emissions reporting — things like electricity used, fuel burned, or distance travelled. My Tasks shows what's due.",
  },
  {
    q: "Where do I enter a number?",
    a: "Enter Data walks you through it one step at a time: pick the facility, pick what you're reporting on, type the amount, confirm the unit, and submit.",
  },
  {
    q: "What if I'm not sure about a number?",
    a: "Save it as a draft from the review step — it's kept, but it won't be submitted for review until you come back and submit it for real.",
  },
  {
    q: "What happens after I submit?",
    a: "A different person on your team reviews and approves it before it's used in a report. You can always see where things stand in My Submissions.",
  },
  {
    q: "Can I upload a spreadsheet instead of typing values in?",
    a: "Yes — Upload Data accepts a CSV of values in one go, mapped to the same facilities and items as Enter Data.",
  },
  {
    q: "Something got sent back to me — what now?",
    a: "Open it from My Tasks. Your original entry is still there — fix what needs fixing and submit it again.",
  },
];

export default function HelpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Help</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Answers to what people ask most.</p>

      <div className="mt-5 flex flex-col gap-2.5">
        {FAQ.map((item) => (
          <div key={item.q} className="glass rounded-[11px] p-4">
            <div className="text-[14px] font-medium">{item.q}</div>
            <p className="mt-1 text-[13.5px] text-ink2">{item.a}</p>
          </div>
        ))}
      </div>
    </>
  );
}
