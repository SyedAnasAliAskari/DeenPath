import {test,expect} from '@playwright/test';
test('charity amount remains private, creates no public counter and can be completed',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:/^Secrets/}).click();
 await page.getByRole('button',{name:'Add secret',exact:true}).click();const f=page.locator('.secret-form');await f.getByLabel('Secret name').fill('Private example');
 await f.getByLabel('Penalty',{exact:true}).selectOption('charity');await f.locator('input[name="amount"]').fill('125.50');await f.getByRole('button',{name:'Save secret'}).click();
 await page.getByRole('button',{name:'Yes, I did',exact:true}).click();await expect(page.getByRole('button',{name:'Mark charity given',exact:true})).toBeVisible();
 const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('salahguard')!));expect(snapshot.records.filter((r:any)=>r.entity==='routines')).toHaveLength(0);expect(JSON.stringify(snapshot)).not.toContain('12550');expect(JSON.stringify(snapshot)).not.toContain('Private example');
 expect(snapshot.settings.privatePenaltyReminders).toHaveLength(1);expect(Object.keys(snapshot.settings.privatePenaltyReminders[0]).sort()).toEqual(['createdAt','dueAt','id']);
 await page.getByRole('button',{name:'Mark charity given',exact:true}).click();await expect(page.getByRole('button',{name:'Mark charity given',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('salahguard')!).settings.privatePenaltyReminders)).toHaveLength(0);
});
