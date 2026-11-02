export function GameIcon({
  name,
}: {
  name: "refresh" | "search" | "save" | "export" | "analyse" | "play" | "edit";
}) {
  const paths = {
    refresh:
      "M20 7v5h-5 M4 17v-5h5 M6 8a7 7 0 0 1 12-2l2 2 M4 16l2 2a7 7 0 0 0 12-2",
    search: "m20 20-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    save: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
    export: "M14 3h7v7 m0-7-12 12 M10 4H4v16h16v-6",
    analyse: "M4 20V12 M10 20V4 M16 20V8 M22 20V2",
    play: "m8 4 12 8-12 8Z",
    edit: "m4 16 12-12 4 4-12 12H4Z",
  };
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
