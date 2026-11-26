const menu=[
  {name:'Classic hot dog',price:5,food:'dog'},
  {name:'Pineapple hot dog',price:7,food:'dog'},
  {name:'Chili cheese dog',price:7,food:'dog'},
  {name:'Crispy fries',price:4,food:'fries'},
  {name:'Loaded nachos',price:6,food:'nachos'},
  {name:'Shave ice',price:5,food:'ice'},
  {name:'Fresh lemonade',price:4,food:'lemonade'}
] as const;
export type SnackFood=typeof menu[number]['food'];
const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});

export function setupSnackMenu(visit:()=>void,prepare:(foods:SnackFood[])=>void,onOrder:()=>void){
  setupShopMenu('snack',menu,visit,prepare,onOrder);
}

export function setupShopMenu<Food extends string>(prefix:string,menu:readonly {name:string;price:number;food:Food;color?:number}[],
  visit:()=>void,prepare:(foods:Food[])=>void,onOrder:()=>void,displayButton?:HTMLButtonElement){
  const dialog=document.querySelector<HTMLDialogElement>('#'+prefix+'-menu')!;
  const items=document.querySelector<HTMLUListElement>('#'+prefix+'-items')!;
  const total=document.querySelector('#'+prefix+'-total')!;
  const order=document.querySelector<HTMLButtonElement>('#'+prefix+'-order')!;
  const receipt=document.querySelector('#'+prefix+'-receipt')!;
  const trigger=document.querySelector<HTMLButtonElement>('#'+prefix+'-view')!;
  let orderNumber=0;
  const rows=menu.map(({name,price,food,color})=>{
    const row=document.createElement('li');
    const selection=document.createElement('div');
    selection.className='snack-quantity';
    const label=document.createElement('span');
    label.textContent=name+' · '+dollars.format(price);
    if(color!==undefined){
      const swatch=document.createElement('span');
      swatch.className='fruit-swatch';
      swatch.style.backgroundColor='#'+color.toString(16).padStart(6,'0');
      swatch.setAttribute('aria-hidden','true');
      label.prepend(swatch);
    }
    const minus=document.createElement('button');
    minus.textContent='−';
    minus.setAttribute('aria-label','Remove '+name);
    const plus=document.createElement('button');
    plus.textContent='+';
    plus.setAttribute('aria-label','Add '+name);
    const count=document.createElement('span');
    selection.append(minus,count,plus);
    row.append(label,selection);
    items.append(row);
    const item={name,price,food,quantity:0,count,minus,plus};
    minus.addEventListener('click',()=>{item.quantity--;render();});
    plus.addEventListener('click',()=>{item.quantity++;render();});
    return item;
  });
  function render(){
    let quantity=0,amount=0;
    for(const row of rows){
      row.count.textContent=String(row.quantity);
      row.minus.disabled=row.quantity===0;
      row.plus.disabled=row.quantity>=20;
      quantity+=row.quantity;
      amount+=row.quantity*row.price;
    }
    order.disabled=quantity===0;
    if(displayButton)displayButton.disabled=quantity===0;
    const itemsLabel=quantity===1?'item':'items';
    total.textContent=quantity===0?'Your basket is empty.':quantity+' '+itemsLabel+' · '+dollars.format(amount);
  }
  const basket=()=>rows.flatMap(({food,quantity})=>Array<Food>(quantity).fill(food));
  displayButton?.addEventListener('click',()=>{
    prepare(basket());
    dialog.close();
    onOrder();
  });
  order.addEventListener('click',()=>{
    if(order.disabled)return;
    const selected=rows.filter(row=>row.quantity>0);
    const summary=selected.map(row=>row.quantity+' × '+row.name).join(', ');
    prepare(displayButton?basket():[...new Set(selected.map(row=>row.food))]);
    const amount=rows.reduce((sum,row)=>sum+row.price*row.quantity,0);
    for(const row of rows)row.quantity=0;
    const confirmation='Order '+(++orderNumber)+' · '+summary+' · '+dollars.format(amount);
    render();
    receipt.textContent=confirmation;
    dialog.close();
    onOrder();
  });
  trigger.addEventListener('click',()=>{
    visit();
    dialog.showModal();
  });
  render();
}

