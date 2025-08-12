export type MatchItem = {
  id?: string | number;
  title?: string;   // keep optional if you sometimes send `name`
  name?: string;    // temporary, for your old mock shape
  price?: string | number;   // <-- allow number too
  store?: string;
  url?: string;
  image?: string;
  match?: number;
};
