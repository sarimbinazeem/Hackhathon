export type Link = {
    id: string;
    from: string;
    to: string;
   };
   
   let links: Link[] = [];
   
   export const addLink = (link: Link) => {
    links.push(link);
   };
   
   export const getLinks = () => links;