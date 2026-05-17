import { Tweet } from "react-tweet";

export function TweetEmbed({ id }: { id: string }) {
  return (
    <div className="my-6 flex justify-center">
      <Tweet id={id} />
    </div>
  );
}
